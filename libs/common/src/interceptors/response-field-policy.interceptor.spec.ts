import 'reflect-metadata';
import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { firstValueFrom, of } from 'rxjs';
import { ResponseFieldPolicies } from '../decorators/response-field-policy.decorator';
import { ResponseFieldPolicyInterceptor } from './response-field-policy.interceptor';

@ResponseFieldPolicies({ path: 'internal', roles: ['RVSK_Admin'] })
class PolicyController {
  @ResponseFieldPolicies({
    path: 'history.*.comment',
    roles: ['RVSK_SPOC', 'State_SPOC', 'State_Admin'],
  })
  detail() {}
}

describe('ResponseFieldPolicyInterceptor', () => {
  const interceptor = new ResponseFieldPolicyInterceptor(new Reflector());
  const response = {
    id: 'grievance-id',
    internal: 'private',
    history: [
      { action: 'CREATED', comment: 'private comment', performedAt: new Date() },
      { action: 'STATUS_CHANGE', comment: null },
    ],
    responses: [{ responseText: 'public response' }],
  };

  async function run(role?: string, value: unknown = response, decorated = true) {
    const context = {
      getHandler: () => decorated ? PolicyController.prototype.detail : () => undefined,
      getClass: () => decorated ? PolicyController : class {},
      switchToHttp: () => ({ getRequest: () => ({ user: role ? { role } : undefined }) }),
    } as unknown as ExecutionContext;
    const handler: CallHandler = { handle: () => of(value) };
    return firstValueFrom(interceptor.intercept(context, handler)) as any;
  }

  it.each(['RVSK_SPOC', 'State_SPOC', 'State_Admin'])('keeps comments for %s', async (role) => {
    const result = await run(role);
    expect(result.history).toEqual(response.history);
    expect(result).not.toHaveProperty('internal');
  });

  it.each(['Super_Admin', 'RVSK_Admin', 'District_Admin', 'unknown', undefined])(
    'omits comments for %s without changing other history fields or the source',
    async (role) => {
      const result = await run(role);
      result.history.forEach((entry: object) => expect(entry).not.toHaveProperty('comment'));
      expect(result.history[0].action).toBe('CREATED');
      expect(result.history[0].performedAt).toBe(response.history[0].performedAt);
      expect(result.responses).toEqual(response.responses);
      expect(response.history[0].comment).toBe('private comment');
      if (role === 'RVSK_Admin') expect(result.internal).toBe('private');
    },
  );

  it('leaves undecorated endpoints unchanged', async () => {
    expect(await run('District_Admin', response, false)).toBe(response);
  });

  it.each([null, { history: null }, { history: [] }, { id: 'no-history' }])(
    'handles absent or empty data: %j', async (value) => {
      expect(await run('District_Admin', value)).toEqual(value);
    },
  );

  it('supports multiple nested policies in a wrapped response', async () => {
    class WrappedController {
      @ResponseFieldPolicies(
        { path: 'data.history.*.comment', roles: ['State_Admin'] },
        { path: 'data.responses.*.responseText', roles: ['RVSK_SPOC'] },
      )
      detail() {}
    }
    const context = {
      getHandler: () => WrappedController.prototype.detail,
      getClass: () => WrappedController,
      switchToHttp: () => ({ getRequest: () => ({ user: { role: 'District_Admin' } }) }),
    } as unknown as ExecutionContext;
    const result: any = await firstValueFrom(interceptor.intercept(context, {
      handle: () => of({ data: response }),
    }));
    expect(result.data.history[0]).not.toHaveProperty('comment');
    expect(result.data.responses[0]).not.toHaveProperty('responseText');
  });
}
);