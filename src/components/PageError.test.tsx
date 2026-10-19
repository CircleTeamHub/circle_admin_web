import {render,screen} from '@testing-library/react';
import {it,expect} from 'vitest';
import {PageError} from './PageError';
import {AdminAccessContext} from '../auth/admin-access';
import {ApiError} from '../api/client';
it.each([false,true])('only shows diagnostic links with audit access (%s)',allowed=>{
 render(<AdminAccessContext.Provider value={{role:'SUPPORT',version:1,permissions:allowed?['AUDIT_READ']:[]}}><PageError error={new ApiError('failure',500,undefined,'request')}/></AdminAccessContext.Provider>);
 expect(screen.queryByRole('link',{name:'查看问题排查'})!==null).toBe(allowed);
});
