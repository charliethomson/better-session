import { render, screen } from "@testing-library/react";

import { describe, it } from "vitest";
import { createSession, s } from "../../session";
import { useSession } from "../index";
import userEvent from "@testing-library/user-event";
import { FC } from "react";
import { act } from "react-dom/test-utils";

describe("react-integration", () => {
  it("reactively updates passed session value", async () => {
    const session = createSession({ testKey: s.string("testKey") });
    const unsetValue = "unsetValue";
    const firstClickValue = "firstClickValue";
    const secondClickValue = "secondClickValue";

    const TestComponent: FC = () => {
      const [value, setValue] = useSession(session.testKey);

      return (
        <div>
          <p data-testid="content">{value ?? unsetValue}</p>
          <button
            type="button"
            data-testid="setButton"
            onClick={() => {
              if (value === null) return setValue(firstClickValue);
              return setValue(secondClickValue);
            }}
          />
        </div>
      );
    };

    render(<TestComponent />);

    const contentContainer = screen.getByTestId("content");
    const button = screen.getByTestId("setButton");
    expect(contentContainer).toBeInTheDocument();
    expect(button).toBeInTheDocument();

    const user = userEvent.setup();

    expect(contentContainer.textContent).toStrictEqual(unsetValue);

    await user.click(button);
    expect(contentContainer.textContent).toStrictEqual(firstClickValue);

    await act(async () => {
      session.testKey.set(secondClickValue);
      // sleep for a bit, to make sure the refresh has happened
      await new Promise((res) => setTimeout(() => res(undefined), 200));
    });

    expect(contentContainer.textContent).toStrictEqual(secondClickValue);
  });
});
