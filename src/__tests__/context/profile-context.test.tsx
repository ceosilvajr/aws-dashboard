// src/__tests__/context/profile-context.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ProfileProvider, useProfile } from "@/context/profile-context";

function TestConsumer() {
  const { profile, setProfile } = useProfile();
  return (
    <div>
      <span data-testid="profile">{profile ?? "null"}</span>
      <button onClick={() => setProfile("my-profile")}>set</button>
      <button onClick={() => setProfile(null)}>clear</button>
    </div>
  );
}

describe("ProfileContext", () => {
  it("defaults to null profile", () => {
    render(<ProfileProvider><TestConsumer /></ProfileProvider>);
    expect(screen.getByTestId("profile").textContent).toBe("null");
  });

  it("updates profile when setProfile is called", () => {
    render(<ProfileProvider><TestConsumer /></ProfileProvider>);
    fireEvent.click(screen.getByText("set"));
    expect(screen.getByTestId("profile").textContent).toBe("my-profile");
  });

  it("clears profile when setProfile(null) is called", () => {
    render(<ProfileProvider><TestConsumer /></ProfileProvider>);
    fireEvent.click(screen.getByText("set"));
    fireEvent.click(screen.getByText("clear"));
    expect(screen.getByTestId("profile").textContent).toBe("null");
  });
});
