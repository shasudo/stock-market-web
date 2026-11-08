import LoginPage from "../login/page";

/** Same account form, register-first. Mirrors the old /register route. */
export default function RegisterPage() {
  return <LoginPage initialMode="register" />;
}
