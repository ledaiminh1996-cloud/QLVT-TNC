from pathlib import Path
p=Path('src/documents/previewStore.ts');s=p.read_text(encoding='utf-8').replace('plate_number: "51R-456.78",','plate_number: "51R-456.78",\n        current_odo_km:654321,',1);p.write_text(s,encoding='utf-8')
