import { describe, expect, it } from '@jest/globals';

import { MAX_NEWS, readNews, readSaved } from '../news-read';

const good = { title: 'Village volunteers plant trees', link: 'https://example.com/a', source: 'Good News Network' };

describe('readNews', () => {
  it('keeps headlines with an https link and a source, tidying spaces', () => {
    expect(readNews({ items: [{ ...good, title: '  Village   volunteers plant trees ' }] })).toEqual([good]);
  });

  it('drops anything else: no https, missing fields, too long, not a list', () => {
    expect(
      readNews({
        items: [
          { ...good, link: 'http://example.com/a' },
          { ...good, link: 'javascript:alert(1)' },
          { ...good, source: '' },
          { ...good, title: 'x'.repeat(201) },
          { title: 'No link', source: 'S' },
          null,
          'text',
        ],
      }),
    ).toEqual([]);
    expect(readNews({ items: 'no' })).toEqual([]);
    expect(readNews(null)).toEqual([]);
  });

  it('keeps at most ten', () => {
    const items = Array.from({ length: 15 }, (_, i) => ({ ...good, link: `https://example.com/${i}` }));
    expect(readNews({ items })).toHaveLength(MAX_NEWS);
  });
});

describe('readSaved', () => {
  it('reads the kept copy back, and nothing from a broken one', () => {
    expect(readSaved({ at: 5, items: [good] })).toEqual({ at: 5, items: [good] });
    expect(readSaved({ at: 'x', items: [good] })).toBeNull();
    expect(readSaved({ at: 5, items: [] })).toBeNull();
    expect(readSaved(undefined)).toBeNull();
  });
});
