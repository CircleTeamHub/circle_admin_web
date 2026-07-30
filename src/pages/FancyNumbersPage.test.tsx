import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addFancyNumberRecommendations,
  listFancyNumberRecommendations,
  reorderFancyNumberRecommendations,
  setFancyNumberRecommendation,
} from "../api/fancy-numbers";
import { FancyNumbersPage, parseRecommendationValues } from "./FancyNumbersPage";

vi.mock("../api/fancy-numbers", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("../api/fancy-numbers")>();
  return {
    ...original,
    addFancyNumberRecommendations: vi.fn(),
    listFancyNumberRecommendations: vi.fn(),
    reorderFancyNumberRecommendations: vi.fn(),
    setFancyNumberRecommendation: vi.fn(),
  };
});

const mockedAdd = vi.mocked(addFancyNumberRecommendations);
const mockedList = vi.mocked(listFancyNumberRecommendations);
const mockedReorder = vi.mocked(reorderFancyNumberRecommendations);
const mockedSetRecommendation = vi.mocked(setFancyNumberRecommendation);

const items = [
  {
    id: "fancy-a",
    value: "AB12C3",
    status: "LEASED" as const,
    source: "ADMIN" as const,
    isRecommended: true,
    sortOrder: 0,
    createdAt: "2026-07-29T00:00:00.000Z",
    updatedAt: "2026-07-29T00:00:00.000Z",
  },
  {
    id: "fancy-b",
    value: "XY98Z7",
    status: "AVAILABLE" as const,
    source: "CUSTOM" as const,
    isRecommended: true,
    sortOrder: 1,
    createdAt: "2026-07-29T00:00:00.000Z",
    updatedAt: "2026-07-29T00:00:00.000Z",
  },
];

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
}

function renderPage() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={client}>
      <FancyNumbersPage />
    </QueryClientProvider>,
  );
}

describe("FancyNumbersPage", () => {
  beforeEach(() => {
    mockedAdd.mockReset();
    mockedList.mockReset();
    mockedReorder.mockReset();
    mockedSetRecommendation.mockReset();
    mockedList.mockResolvedValue({ items });
    mockedAdd.mockResolvedValue({ items });
    mockedReorder.mockResolvedValue({ items: [items[1], items[0]] });
    mockedSetRecommendation.mockResolvedValue({
      ...items[0],
      isRecommended: false,
    });
  });

  it("parses, uppercases, and deduplicates recommendation input", () => {
    expect(parseRecommendationValues(" ab12c3,XY98z7\nAB12C3 ")).toEqual([
      "AB12C3",
      "XY98Z7",
    ]);
  });

  it("shows occupied recommendations and explains automatic App hiding", async () => {
    renderPage();

    expect(await screen.findByText("AB12C3")).toBeInTheDocument();
    expect(screen.getByText("租用中")).toBeInTheDocument();
    expect(
      screen.getByText(/被购买的号码会自动从 App 热门推荐中隐藏/),
    ).toBeInTheDocument();
  });

  it("adds a normalized batch from the modal", async () => {
    renderPage();

    fireEvent.click(
      await screen.findByRole("button", { name: "添加热门靓号" }),
    );
    fireEvent.change(screen.getByLabelText("靓号列表"), {
      target: { value: "ab12c3\nxy98z7" },
    });
    fireEvent.click(screen.getByRole("button", { name: "确认添加" }));

    await waitFor(() => expect(mockedAdd).toHaveBeenCalled());
    expect(mockedAdd.mock.calls[0]?.[0]).toEqual(["AB12C3", "XY98Z7"]);
  });

  it("moves a recommendation with the accessible ordering controls", async () => {
    renderPage();

    fireEvent.click(
      await screen.findByRole("button", { name: "上移 XY98Z7" }),
    );

    await waitFor(() =>
      expect(mockedReorder).toHaveBeenCalledWith(
        ["fancy-a", "fancy-b"],
        ["fancy-b", "fancy-a"],
      ),
    );
    await waitFor(() => expect(mockedList).toHaveBeenCalledTimes(2));
  });

  it("locks every write control while an ordering write is pending", async () => {
    const pendingReorder = deferred<{ items: typeof items }>();
    mockedReorder.mockReturnValue(pendingReorder.promise);
    renderPage();

    fireEvent.click(
      await screen.findByRole("button", { name: "上移 XY98Z7" }),
    );

    await waitFor(() => expect(mockedReorder).toHaveBeenCalled());
    expect(
      screen.getByRole("button", { name: "添加热门靓号" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "从热门下架 AB12C3" }),
    ).toBeDisabled();

    pendingReorder.resolve({ items: [items[1], items[0]] });
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "添加热门靓号" }),
      ).toBeEnabled(),
    );
  });

  it("refetches the authoritative list after taking a recommendation down", async () => {
    mockedList
      .mockResolvedValueOnce({ items })
      .mockResolvedValue({ items: [items[1]] });
    renderPage();

    fireEvent.click(
      await screen.findByRole("button", { name: "从热门下架 AB12C3" }),
    );

    await waitFor(() =>
      expect(mockedSetRecommendation).toHaveBeenCalledWith("fancy-a", false),
    );
    await waitFor(() => expect(mockedList).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.queryByText("AB12C3")).not.toBeInTheDocument(),
    );
  });

  it("clears a canceled row drag before accepting any later drop", async () => {
    renderPage();

    const firstRow = (await screen.findByText("AB12C3")).closest("tr");
    const secondRow = screen.getByText("XY98Z7").closest("tr");
    expect(firstRow).not.toBeNull();
    expect(secondRow).not.toBeNull();

    fireEvent.dragStart(firstRow as HTMLElement);
    fireEvent.dragEnd(firstRow as HTMLElement);
    fireEvent.dragOver(secondRow as HTMLElement);
    fireEvent.drop(secondRow as HTMLElement);

    expect(mockedReorder).not.toHaveBeenCalled();
  });
});
