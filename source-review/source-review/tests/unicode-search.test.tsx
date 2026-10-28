import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSearch, searchIncludes, searchPattern } from '../shared/searchText';

test('Vietnamese uppercase lowercase and canonical Unicode spellings match without changing accents',()=>{
 for(const query of ['đại long','Đại Long','ĐẠI LONG','đại long'.normalize('NFD')])assert.ok(searchIncludes('CÔNG TY ĐẠI LONG',query));
 assert.equal(normalizeSearch('ĐẠI LONG'),normalizeSearch('đại long'));
 assert.equal(searchIncludes('ĐẠI LONG','dai long'),false);
 assert.ok(searchIncludes('ắ Ằ Ễ Ỳ Ỹ Đ','Ắ ằ ễ ỳ ỹ đ'));
 assert.equal(searchIncludes(null,'đại long'),false);
 assert.equal(searchPattern('A%_\\B'),'%a\\%\\_\\\\b%');
});
