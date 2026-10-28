CREATE TABLE vat_rates (
 id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
 rate_pct INTEGER NOT NULL UNIQUE CHECK(rate_pct IN (0,5,8,10)),
 is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0,1)),
 notes TEXT, version INTEGER NOT NULL DEFAULT 1 CHECK(version>=1)
);
INSERT INTO vat_rates(id,code,name,rate_pct) VALUES
 ('vat-0','VAT00','VAT 0%',0),('vat-5','VAT05','VAT 5%',5),('vat-8','VAT08','VAT 8%',8),('vat-10','VAT10','VAT 10%',10);
