import { signInWithEntra, signOutToHome } from "@/app/_actions/auth";

export function SignInButton() {
  return (
    <form action={signInWithEntra}>
      <button type="submit">Sign in with Microsoft</button>
    </form>
  );
}

export function SignOutButton() {
  return (
    <form action={signOutToHome}>
      <button type="submit">Sign out</button>
    </form>
  );
}
