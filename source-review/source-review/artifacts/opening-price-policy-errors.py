from pathlib import Path
p=Path('worker/src/documents.ts');s=p.read_text(encoding='utf-8');s=s.replace('    if(complete&&openingUsageAssessment(line).amount_vnd===null)return fail(`Dòng ${index+1}: nhập đủ Nguyên giá, Tỷ lệ còn lại (%) và Người xác nhận.`);','''    if(complete){
      let amount:number|null;
      try{amount=openingUsageAssessment(line).amount_vnd}catch(e){return fail(`Dòng ${index+1}: ${e instanceof Error?e.message:"Số liệu định giá không hợp lệ."}`)}
      if(amount===null)return fail(`Dòng ${index+1}: nhập đủ Nguyên giá, Tỷ lệ còn lại (%) và Người xác nhận.`);
    }''');p.write_text(s,encoding='utf-8')
