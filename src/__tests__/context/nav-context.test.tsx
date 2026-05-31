// src/__tests__/context/nav-context.test.tsx
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NavProvider, useNav } from "@/context/nav-context";

function TestConsumer() {
  const { section, setSection } = useNav();
  return (
    <div>
      <span data-testid="section">{section}</span>
      <button onClick={() => setSection("s3")}>go-s3</button>
      <button onClick={() => setSection("cognito")}>go-cognito</button>
      <button onClick={() => setSection("push-notifications")}>go-push</button>
    </div>
  );
}

describe("NavContext", () => {
  it("defaults to dashboard section", () => {
    render(<NavProvider><TestConsumer /></NavProvider>);
    expect(screen.getByTestId("section").textContent).toBe("dashboard");
  });

  it("updates section when setSection is called", () => {
    render(<NavProvider><TestConsumer /></NavProvider>);
    fireEvent.click(screen.getByText("go-s3"));
    expect(screen.getByTestId("section").textContent).toBe("s3");
  });

  it("accepts push-notifications as a valid section", () => {
    render(<NavProvider><TestConsumer /></NavProvider>);
    fireEvent.click(screen.getByText("go-push"));
    expect(screen.getByTestId("section").textContent).toBe("push-notifications");
  });
});
