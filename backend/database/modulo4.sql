BEGIN;
CREATE TABLE IF NOT EXISTS usuarios (
 id SERIAL PRIMARY KEY,
 nome VARCHAR(120) NOT NULL,
 email VARCHAR(180) NOT NULL UNIQUE,
 cargo VARCHAR(100) NOT NULL DEFAULT '',
 login VARCHAR(60) NOT NULL UNIQUE,
 senha_hash TEXT NOT NULL,
 recuperacao_hash TEXT,
 perfil VARCHAR(20) NOT NULL CHECK (perfil IN ('Administrador','Operador')),
 ativo BOOLEAN NOT NULL DEFAULT TRUE,
 excluido BOOLEAN NOT NULL DEFAULT FALSE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS sessoes (
 token_hash VARCHAR(64) PRIMARY KEY,
 usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
 expira_em TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS produtos (
 id SERIAL PRIMARY KEY,
 nome VARCHAR(120) NOT NULL,
 modelo VARCHAR(100) NOT NULL,
 quantidade INTEGER NOT NULL DEFAULT 0 CHECK (quantidade BETWEEN 0 AND 1000000000),
 estoque_minimo INTEGER NOT NULL DEFAULT 5 CHECK (estoque_minimo BETWEEN 0 AND 1000000000),
 valor_unitario NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (valor_unitario >= 0),
 excluido BOOLEAN NOT NULL DEFAULT FALSE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS produtos_nome_modelo_ativo ON produtos (LOWER(nome), LOWER(modelo)) WHERE excluido = FALSE;
CREATE TABLE IF NOT EXISTS manutencoes (
 id SERIAL PRIMARY KEY,
 veiculo_id INTEGER NOT NULL REFERENCES veiculos(id) ON DELETE RESTRICT,
 data DATE NOT NULL,
 tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('Preventiva','Corretiva')),
 servico VARCHAR(200) NOT NULL,
 custo NUMERIC(10,2) NOT NULL CHECK (custo >= 0),
 mecanico VARCHAR(120) NOT NULL,
 observacoes VARCHAR(1000) NOT NULL DEFAULT '',
 status VARCHAR(30) NOT NULL CHECK (status IN ('Em andamento','Concluída')),
 produto_id INTEGER REFERENCES produtos(id) ON DELETE RESTRICT,
 quantidade_pecas INTEGER NOT NULL DEFAULT 0,
 excluido BOOLEAN NOT NULL DEFAULT FALSE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CONSTRAINT manutencao_pecas_validas CHECK ((produto_id IS NULL AND quantidade_pecas=0) OR (produto_id IS NOT NULL AND quantidade_pecas BETWEEN 1 AND 1000000000))
);
CREATE TABLE IF NOT EXISTS movimentacoes (
 id SERIAL PRIMARY KEY,
 produto_id INTEGER NOT NULL REFERENCES produtos(id) ON DELETE RESTRICT,
 tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('Entrada','Saída')),
 quantidade INTEGER NOT NULL CHECK (quantidade BETWEEN 1 AND 1000000000),
 saldo_anterior INTEGER NOT NULL CHECK (saldo_anterior >= 0),
 saldo_posterior INTEGER NOT NULL CHECK (saldo_posterior BETWEEN 0 AND 1000000000),
 motivo VARCHAR(500) NOT NULL,
 usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
 manutencao_id INTEGER REFERENCES manutencoes(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 CONSTRAINT movimento_saldo_correto CHECK ((tipo='Entrada' AND saldo_posterior=saldo_anterior+quantidade) OR (tipo='Saída' AND saldo_posterior=saldo_anterior-quantidade))
);
CREATE TABLE IF NOT EXISTS atividades (
 id SERIAL PRIMARY KEY,
 modulo VARCHAR(40) NOT NULL,
 descricao TEXT NOT NULL,
 usuario_nome VARCHAR(120) NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS movimentacoes_produto_data ON movimentacoes(produto_id,created_at DESC);
CREATE INDEX IF NOT EXISTS manutencoes_veiculo_data ON manutencoes(veiculo_id,data DESC);
CREATE INDEX IF NOT EXISTS sessoes_expiracao ON sessoes(expira_em);
COMMIT;
