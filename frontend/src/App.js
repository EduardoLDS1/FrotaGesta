import { useEffect, useState } from "react";
import { api } from "./services/api";
import { Brand, Icon, Notice } from "./components/UI";
import Login from "./pages/Login";
import Home from "./pages/Home";
import Veiculos from "./pages/Veiculos";
import Estoque from "./pages/Estoque";
import Viagens from "./pages/Viagens";
import Despesas from "./pages/Despesas";
import Manutencoes from "./pages/Manutencoes";
import Relatorios from "./pages/Relatorios";
import Usuarios from "./pages/Usuarios";
import "./App.css";
const paginas = [
  ["home", "Home", "home"],
  ["veiculos", "Veículos", "car"],
  ["manutencoes", "Manutenções", "tools"],
  ["viagens", "Viagens", "route"],
  ["despesas", "Despesas", "wallet"],
  ["estoque", "Estoque", "stock"],
  ["relatorios", "Relatórios", "chart"],
  ["usuarios", "Usuários", "users"],
];
export default function App() {
  const [usuario, setUsuario] = useState(null),
    [carregando, setCarregando] = useState(true),
    [error, setError] = useState(""),
    [pagina, setPagina] = useState("home"),
    [saindo, setSaindo] = useState(false);
  useEffect(() => {
    let ativa = true;
    api("/auth/me")
      .then((u) => {
        if (ativa) setUsuario(u);
      })
      .catch((e) => {
        if (ativa && e.status !== 401) setError(e.message);
      })
      .finally(() => {
        if (ativa) setCarregando(false);
      });
    const expirar = () => {
      setUsuario(null);
      setError("Sua sessão expirou. Entre novamente.");
    };
    window.addEventListener("sessao-expirada", expirar);
    return () => {
      ativa = false;
      window.removeEventListener("sessao-expirada", expirar);
    };
  }, []);
  async function sair() {
    if (saindo) return;
    setSaindo(true);
    setError("");
    try {
      await api("/auth/logout", { method: "POST", body: {} });
      setUsuario(null);
      setPagina("home");
    } catch (e) {
      setError(e.message);
    } finally {
      setSaindo(false);
    }
  }
  function go(p) {
    setPagina(p);
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  if (carregando)
    return (
      <div className="initial-loading" role="status">
        Carregando FrotaGesta…
      </div>
    );
  if (!usuario)
    return (
      <>
        <div className="login-global-notice">
          <Notice error={error} />
        </div>
        <Login
          onLogin={(u) => {
            setUsuario(u);
            setError("");
            setPagina("home");
          }}
        />
      </>
    );
  const paginasPermitidas = paginas.filter(
    (p) => p[0] !== "usuarios" || usuario.perfil === "Administrador",
  );
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button
          className="brand-button"
          onClick={() => go("home")}
          aria-label="FrotaGesta, início"
        >
          <Brand />
        </button>
        <nav aria-label="Menu principal">
          {paginasPermitidas.map(([chave, label, icon]) => (
            <button
              key={chave}
              className={pagina === chave ? "active" : ""}
              aria-current={pagina === chave ? "page" : undefined}
              onClick={() => go(chave)}
            >
              <Icon name={icon} />
              {label}
            </button>
          ))}
        </nav>
        <button className="sidebar-exit" onClick={sair} disabled={saindo}>
          <Icon name="logout" />
          Sair
        </button>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <strong>
            <Icon name="users" />
            Bem-vindo, {usuario.nome}
          </strong>
          <div className="topbar-actions">
            <button
              className="bell-button"
              aria-label="Ver alertas de estoque"
              title="Alertas de estoque"
              onClick={() => go("estoque")}
            >
              <Icon name="bell" />
            </button>
            <span className="profile-label">{usuario.perfil}</span>
            <button className="logout-button" onClick={sair} disabled={saindo}>
              <Icon name="logout" />
              {saindo ? "Saindo…" : "Sair"}
            </button>
          </div>
        </header>
        <main className="content">
          <Notice error={error} />
          {pagina === "home" && <Home go={go} />}{" "}
          {pagina === "veiculos" && <Veiculos />}{" "}
          {pagina === "manutencoes" && <Manutencoes />}{" "}
          {pagina === "estoque" && <Estoque />}{" "}
          {pagina === "viagens" && <Viagens />}{" "}
          {pagina === "despesas" && <Despesas />}{" "}
          {pagina === "relatorios" && <Relatorios />}{" "}
          {pagina === "usuarios" && usuario.perfil === "Administrador" && (
            <Usuarios usuario={usuario} />
          )}
        </main>
        <footer className="main-footer">
          FrotaGesta · Gestão de frota e estoque
        </footer>
      </div>
    </div>
  );
}
