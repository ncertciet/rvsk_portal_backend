import * as fc from 'fast-check';
import { PageResponse } from '@rvsk/common';

/**
 * Property 11: Pagination Response Consistency
 * **Validates: Requirements 5.2, 9.4**
 *
 * Tests PageResponse invariants:
 * - content.length <= size
 * - totalPages = ceil(totalElements / size)
 * - page = P (the requested page)
 */

describe('Property: Pagination Response Consistency (Property 11)', () => {
  it('content.length <= size, totalPages = ceil(totalElements / size), page = P', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 1000 }), // totalElements
        fc.integer({ min: 0, max: 50 }), // page
        fc.integer({ min: 1, max: 100 }), // size
        (totalElements, page, size) => {
          const contentLength = Math.min(
            size,
            Math.max(0, totalElements - page * size),
          );
          const content = Array(contentLength).fill({});
          const response = new PageResponse(content, totalElements, page, size);

          return (
            response.content.length <= size &&
            response.totalPages === Math.ceil(totalElements / size) &&
            response.page === page
          );
        },
      ),
    );
  });
});
