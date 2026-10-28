export function foldDocumentSearch(value: unknown): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase();
}
export function documentSearchPattern(value: string): string {
  return (
    "%" + foldDocumentSearch(value.trim()).replace(/[\\%_]/g, "\\$&") + "%"
  );
}

/** Bound SQLite GLOB for legacy Vietnamese snapshots that predate normalized search_text. */
export function documentSearchGlob(value:string):string{
 const groups:Record<string,string>={a:'aáàảãạăắằẳẵặâấầẩẫậ',e:'eéèẻẽẹêếềểễệ',i:'iíìỉĩị',o:'oóòỏõọôốồổỗộơớờởỡợ',u:'uúùủũụưứừửữự',y:'yýỳỷỹỵ',d:'dđ'};
 return '*'+[...foldDocumentSearch(value.trim())].map(c=>{if(groups[c])return '['+groups[c]+groups[c].toUpperCase()+']';if(/[a-z]/.test(c))return '['+c+c.toUpperCase()+']';return c==='*'?'[*]':c==='?'?'[?]':c==='['?'[[]':c===']'?'[]]':c}).join('')+'*';
}
