import { useState } from "react";
import { api } from "../services/api";
import { Brand, Field, Password, Notice, Icon } from "../components/UI";
export default function Login({ onLogin }) {
  const [acesso, setAcesso] = useState(""),
    [senha, setSenha] = useState(""),
    [codigo, setCodigo] = useState(""),
    [recuperar, setRecuperar] = useState(false),
    [novoCodigo, setNovoCodigo] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (recuperar) {
        const r = await api("/auth/recuperar", {
          method: "POST",
          body: { acesso, senha, codigo },
        });
        setNovoCodigo(r.codigo);
        setSenha("");
      } else {
        onLogin(
          await api("/auth/login", { method: "POST", body: { acesso, senha } }),
        );
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="login-screen">
      <Brand />
      <h1>{recuperar ? "Recupere seu acesso" : "Acesse o Sistema"}</h1>
      <div className="login-line" />
      <form className="login-card" onSubmit={submit}>
        <Notice error={error} />
        {novoCodigo ? (
          <>
            <h2>Senha redefinida</h2>
            <p>
              Guarde seu novo código de recuperação. O anterior não funciona
              mais.
            </p>
            <code className="recovery-code">{novoCodigo}</code>
            <button
              type="button"
              className="button primary"
              onClick={() => {
                setNovoCodigo("");
                setRecuperar(false);
                setCodigo("");
              }}
            >
              Voltar ao login
            </button>
          </>
        ) : (
          <>
            <Field
              label="Usuário ou E-mail"
              name="acesso"
              value={acesso}
              onChange={(_, v) => setAcesso(v)}
              placeholder="Digite seu usuário ou e-mail"
              required
              maxLength={180}
              autoComplete="username"
            />
            {recuperar && (
              <>
                <p className="helper">
                  Use o código recebido no cadastro. Se não o tiver, solicite um
                  novo ao administrador.
                </p>
                <Field
                  label="Código de recuperação"
                  name="codigo"
                  value={codigo}
                  onChange={(_, v) => setCodigo(v)}
                  required
                  maxLength={100}
                />
              </>
            )}
            <Password
              label={recuperar ? "Nova senha" : "Senha"}
              value={senha}
              onChange={setSenha}
              minLength={recuperar ? 8 : 1}
            />
            <button className="button login-submit" disabled={busy}>
              <Icon name="logout" />
              {busy ? "Aguarde…" : recuperar ? "Redefinir senha" : "Entrar"}
            </button>
          </>
        )}
      </form>
      {!novoCodigo && (
        <button
          className="text-button"
          onClick={() => {
            setRecuperar(!recuperar);
            setError("");
            setSenha("");
          }}
        >
          {recuperar ? "Voltar para o login" : "Esqueceu sua senha?"}
        </button>
      )}
    </main>
  );
}
