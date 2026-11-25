import { NavLink } from "react-router-dom";
import styles from "../styles/inspections.module.css";
export function InspectionsNav() {
  return (
    <nav className={styles.nav} aria-label="Vistorias">
      <NavLink end to="/polling-place-inspections">
        Painel
      </NavLink>
      <NavLink to="/polling-place-inspections/list">Listagem</NavLink>
      <NavLink to="/polling-place-inspections/new">Nova vistoria</NavLink>
    </nav>
  );
}
