BEGIN;
ALTER TABLE veiculos ADD COLUMN IF NOT EXISTS primeiro_vencimento DATE;
ALTER TABLE veiculos ADD COLUMN IF NOT EXISTS parcela_inicio_automatica INTEGER;
ALTER TABLE despesas_veiculos ADD COLUMN IF NOT EXISTS situacao_pagamento VARCHAR(12) NOT NULL DEFAULT 'Pago';
ALTER TABLE despesas_veiculos ADD COLUMN IF NOT EXISTS gerada_automaticamente BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE despesas_veiculos ADD COLUMN IF NOT EXISTS recorrencia_indice INTEGER;
ALTER TABLE despesas_veiculos ADD COLUMN IF NOT EXISTS data_pagamento DATE;
ALTER TABLE despesas_veiculos ADD COLUMN IF NOT EXISTS comprovante_arquivo VARCHAR(100);
ALTER TABLE despesas_veiculos ADD COLUMN IF NOT EXISTS comprovante_nome VARCHAR(200);
ALTER TABLE despesas_veiculos ADD COLUMN IF NOT EXISTS comprovante_mime VARCHAR(60);
UPDATE despesas_veiculos SET data_pagamento=data
 WHERE situacao_pagamento='Pago' AND data_pagamento IS NULL AND gerada_automaticamente=FALSE;
CREATE UNIQUE INDEX IF NOT EXISTS despesa_recorrente_unica
 ON despesas_veiculos(veiculo_id,categoria,recorrencia_indice)
 WHERE gerada_automaticamente=TRUE;
CREATE INDEX IF NOT EXISTS despesa_pagamento_status ON despesas_veiculos(situacao_pagamento,data);
COMMIT;
