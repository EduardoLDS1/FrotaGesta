BEGIN;
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS codigo VARCHAR(50);
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS categoria VARCHAR(80) NOT NULL DEFAULT 'Não informado';
ALTER TABLE produtos ADD COLUMN IF NOT EXISTS fornecedor VARCHAR(120) NOT NULL DEFAULT 'Não informado';
UPDATE produtos SET codigo = 'LEGADO-' || id WHERE codigo IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS produtos_codigo_ativo ON produtos (LOWER(codigo)) WHERE excluido=FALSE AND codigo IS NOT NULL;
ALTER TABLE veiculos ADD COLUMN IF NOT EXISTS situacao_operacional VARCHAR(20) NOT NULL DEFAULT 'Ativo';
ALTER TABLE veiculos ADD COLUMN IF NOT EXISTS revisao_prevista_data DATE;
ALTER TABLE veiculos ADD COLUMN IF NOT EXISTS revisao_prevista_km NUMERIC(12,2);
ALTER TABLE veiculos DROP CONSTRAINT IF EXISTS veiculos_situacao_operacional_check;
ALTER TABLE veiculos ADD CONSTRAINT veiculos_situacao_operacional_check CHECK (situacao_operacional IN ('Ativo','Inativo','Indisponível'));
ALTER TABLE veiculos DROP CONSTRAINT IF EXISTS veiculos_revisao_km_valido;
ALTER TABLE veiculos ADD CONSTRAINT veiculos_revisao_km_valido CHECK (revisao_prevista_km IS NULL OR revisao_prevista_km>=0);
ALTER TABLE manutencoes ADD COLUMN IF NOT EXISTS custo_inclui_pecas BOOLEAN NOT NULL DEFAULT FALSE;
CREATE TABLE IF NOT EXISTS manutencao_itens (
  manutencao_id INTEGER NOT NULL REFERENCES manutencoes(id) ON DELETE RESTRICT,
  produto_id INTEGER NOT NULL REFERENCES produtos(id) ON DELETE RESTRICT,
  quantidade INTEGER NOT NULL CHECK(quantidade>0),
  valor_unitario NUMERIC(10,2) NOT NULL CHECK(valor_unitario>=0),
  PRIMARY KEY(manutencao_id, produto_id)
);
INSERT INTO manutencao_itens(manutencao_id,produto_id,quantidade,valor_unitario)
 SELECT m.id,m.produto_id,m.quantidade_pecas,p.valor_unitario FROM manutencoes m
 JOIN produtos p ON p.id=m.produto_id WHERE m.produto_id IS NOT NULL AND m.quantidade_pecas>0
 ON CONFLICT (manutencao_id,produto_id) DO NOTHING;
UPDATE manutencoes SET custo_inclui_pecas=TRUE WHERE produto_id IS NOT NULL AND quantidade_pecas>0;
COMMIT;
