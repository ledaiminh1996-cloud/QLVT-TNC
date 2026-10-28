export function mountPositionLabel(row:Record<string,unknown>):string {
 const group=String(row.notes??"");
 return (["Đầu kéo","Rơ moóc"].includes(group)?group+" – ":"")+String(row.name??"");
}
