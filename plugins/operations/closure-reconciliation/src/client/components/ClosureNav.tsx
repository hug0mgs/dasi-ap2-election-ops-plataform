import { NavLink } from "react-router-dom";
import styles from "../styles/closure-reconciliation.module.css";

export function ClosureNav() {
  return (
    <nav className={styles.nav} aria-label="Conciliação de encerramento">
      <NavLink end to="/closure-reconciliation">
        Painel
      </NavLink>
      <NavLink to="/closure-reconciliation/list">Listagem</NavLink>
      <NavLink to="/closure-reconciliation/new">Nova conciliação</NavLink>
    </nav>
  );
}
