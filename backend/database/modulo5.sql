BEGIN;
ALTER TABLE veiculos ADD COLUMN IF NOT EXISTS combustivel VARCHAR(20) NOT NULL DEFAULT 'Gasolina';
ALTER TABLE veiculos ADD COLUMN IF NOT EXISTS consumo_medio NUMERIC(8,3);
ALTER TABLE veiculos ADD COLUMN IF NOT EXISTS preco_litro NUMERIC(10,2);
ALTER TABLE veiculos ADD COLUMN IF NOT EXISTS situacao_aquisicao VARCHAR(20) NOT NULL DEFAULT 'Não informado';
ALTER TABLE veiculos ADD COLUMN IF NOT EXISTS data_aquisicao DATE;
ALTER TABLE veiculos ADD COLUMN IF NOT EXISTS valor_compra NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE veiculos ADD COLUMN IF NOT EXISTS valor_entrada NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE veiculos ADD COLUMN IF NOT EXISTS valor_parcela NUMERIC(12,2) NOT NULL DEFAULT 0;
ALTER TABLE veiculos ADD COLUMN IF NOT EXISTS total_parcelas INTEGER NOT NULL DEFAULT 0;
ALTER TABLE veiculos ADD COLUMN IF NOT EXISTS parcelas_pagas INTEGER NOT NULL DEFAULT 0;
ALTER TABLE veiculos ADD COLUMN IF NOT EXISTS observacoes_financeiras VARCHAR(500) NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS viagens (
  id SERIAL PRIMARY KEY,
  veiculo_id INTEGER NOT NULL REFERENCES veiculos(id) ON DELETE RESTRICT,
  motorista VARCHAR(120) NOT NULL,
  destino VARCHAR(180) NOT NULL,
  finalidade VARCHAR(300) NOT NULL DEFAULT '',
  km_saida NUMERIC(12,2) NOT NULL CHECK (km_saida >= 0),
  km_chegada NUMERIC(12,2) CHECK (km_chegada >= km_saida),
  saida_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  chegada_em TIMESTAMPTZ,
  consumo_medio NUMERIC(8,3) CHECK (consumo_medio > 0),
  preco_litro NUMERIC(10,2) CHECK (preco_litro > 0),
  observacoes VARCHAR(500) NOT NULL DEFAULT '',
  CHECK ((chegada_em IS NULL AND km_chegada IS NULL) OR (chegada_em IS NOT NULL AND km_chegada IS NOT NULL))
);
CREATE UNIQUE INDEX IF NOT EXISTS viagem_aberta_por_veiculo ON viagens (veiculo_id) WHERE chegada_em IS NULL;
CREATE INDEX IF NOT EXISTS viagens_periodo ON viagens (chegada_em DESC,veiculo_id);

CREATE TABLE IF NOT EXISTS despesas_veiculos (
  id SERIAL PRIMARY KEY,
  veiculo_id INTEGER NOT NULL REFERENCES veiculos(id) ON DELETE RESTRICT,
  viagem_id INTEGER REFERENCES viagens(id) ON DELETE RESTRICT,
  data DATE NOT NULL,
  categoria VARCHAR(30) NOT NULL CHECK (categoria IN ('Combustível','Pedágio','Estacionamento','Seguro','IPVA','Licenciamento','Financiamento','Lavagem','Multa','Aluguel','Outros')),
  valor NUMERIC(12,2) NOT NULL CHECK (valor > 0),
  litros NUMERIC(10,3) CHECK (litros > 0),
  descricao VARCHAR(500) NOT NULL DEFAULT '',
  parcela_contabilizada BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (categoria='Combustível' OR litros IS NULL)
);
CREATE INDEX IF NOT EXISTS despesas_veiculo_data ON despesas_veiculos(veiculo_id,data DESC);
COMMIT;
