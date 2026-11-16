BEGIN;
ALTER TABLE veiculos ADD COLUMN IF NOT EXISTS excluido BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE viagens ADD COLUMN IF NOT EXISTS valor_combustivel NUMERIC(12,2);
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='viagens_combustivel_nao_negativo') THEN
  ALTER TABLE viagens ADD CONSTRAINT viagens_combustivel_nao_negativo CHECK (valor_combustivel >= 0) NOT VALID;
 END IF;
END $$;
ALTER TABLE despesas_veiculos ADD COLUMN IF NOT EXISTS origem_viagem BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE despesas_veiculos DROP CONSTRAINT IF EXISTS despesas_veiculos_categoria_check;
ALTER TABLE despesas_veiculos DROP CONSTRAINT IF EXISTS despesas_categoria_v7;
ALTER TABLE despesas_veiculos ADD CONSTRAINT despesas_categoria_v7 CHECK (
  categoria IN ('Combustível','Manutenção','Peças','Pedágio','Estacionamento','Seguro',
  'IPVA','Licenciamento','Financiamento','Lavagem','Multa','Aluguel','Outros')
);
CREATE UNIQUE INDEX IF NOT EXISTS despesa_por_viagem_unica
  ON despesas_veiculos(viagem_id) WHERE origem_viagem=TRUE;
CREATE INDEX IF NOT EXISTS despesas_veiculos_categoria_data
  ON despesas_veiculos(veiculo_id,categoria,data_pagamento);
COMMIT;
