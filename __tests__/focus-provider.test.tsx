import {
  FocusBar,
  FocusProvider,
  type FocusBucket,
} from "@/app/components/focus-provider";
import { ToastContext } from "@/app/context/toast.provider";
import BucketDetail from "@/app/main/bucket-detail";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeBucket } from "./helpers";

const refresh = vi.fn();
const setToasts = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh }),
}));

const buckets: FocusBucket[] = [
  { id: 10, name: "Launch ideas", active: true },
  { id: 11, name: "Games", active: true },
  { id: 12, name: "Music", active: false },
];

function renderBoard(focusBuckets = buckets, children = <FocusBar />) {
  return render(
    <ToastContext.Provider value={{ toasts: [], setToasts }}>
      <FocusProvider buckets={focusBuckets} limit={2}>
        {children}
      </FocusProvider>
    </ToastContext.Provider>,
  );
}

function focusBodies() {
  return vi
    .mocked(fetch)
    .mock.calls.filter(([url]) => url === "/api/buckets/focus")
    .map(([, init]) => JSON.parse(String(init?.body)));
}

describe("focus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => [] }),
    );
  });

  describe("FocusBar", () => {
    it("lists what's being worked on", () => {
      renderBoard();

      expect(screen.getByText("Working on")).toBeInTheDocument();
      expect(screen.getByText("Launch ideas")).toBeInTheDocument();
      expect(screen.getByText("Games")).toBeInTheDocument();
      expect(screen.queryByText("Music")).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Change" }),
      ).toBeInTheDocument();
    });

    it("invites a choice when nothing is active", () => {
      renderBoard(buckets.map((bucket) => ({ ...bucket, active: false })));

      expect(
        screen.getByText(/Not working on anything yet. Pick up to 2/),
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Choose" }),
      ).toBeInTheDocument();
    });

    it("lets you pick the active buckets, parking the rest", async () => {
      const user = userEvent.setup();
      renderBoard();

      await user.click(screen.getByRole("button", { name: "Change" }));
      const picker = within(screen.getByRole("dialog"));
      expect(picker.getByLabelText("Launch ideas")).toBeChecked();
      expect(picker.getByLabelText("Music")).not.toBeChecked();

      await user.click(picker.getByLabelText("Games"));
      await user.click(picker.getByLabelText("Music"));
      await user.click(picker.getByRole("button", { name: "Save" }));

      expect(focusBodies()).toEqual([{ bucketIds: [10, 12] }]);
      expect(refresh).toHaveBeenCalled();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  describe("in a bucket", () => {
    async function openBucket(id: number, focusBuckets = buckets) {
      const user = userEvent.setup();
      const bucket = makeBucket({
        id,
        name: focusBuckets.find((item) => item.id === id)!.name,
        activeSince: focusBuckets.find((item) => item.id === id)!.active
          ? new Date()
          : null,
      });
      renderBoard(focusBuckets, <BucketDetail bucket={bucket} ideas={[]} />);
      return user;
    }

    it("badges an active bucket and parks it", async () => {
      const user = await openBucket(11);

      expect(screen.getAllByText("Working on").length).toBeGreaterThan(0);
      await user.click(screen.getByRole("button", { name: "Park" }));

      expect(focusBodies()).toEqual([{ bucketIds: [10] }]);
      expect(setToasts).toHaveBeenCalledWith([
        expect.objectContaining({ message: 'Parked "Games"' }),
      ]);
    });

    it("starts working on a parked bucket when there's room", async () => {
      const user = await openBucket(12, [
        { id: 10, name: "Launch ideas", active: true },
        { id: 12, name: "Music", active: false },
      ]);

      expect(screen.queryByText("Working on")).not.toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Work on this" }));

      expect(focusBodies()).toEqual([{ bucketIds: [10, 12] }]);
    });

    it("asks which to park when already at the limit", async () => {
      const user = await openBucket(12);

      await user.click(screen.getByRole("button", { name: "Work on this" }));

      const picker = within(
        screen.getByRole("dialog", { name: "Choose what you're working on" }),
      );
      expect(picker.getByLabelText("Music")).toBeChecked();
      expect(picker.getByText("Untick 1 to park it")).toBeInTheDocument();
      expect(picker.getByRole("button", { name: "Save" })).toBeDisabled();
      expect(focusBodies()).toEqual([]);

      await user.click(picker.getByLabelText("Launch ideas"));
      expect(picker.getByText("2 of 2 picked")).toBeInTheDocument();
      await user.click(picker.getByRole("button", { name: "Save" }));

      expect(focusBodies()).toEqual([{ bucketIds: [11, 12] }]);
    });

    it("toasts when saving fails", async () => {
      vi.mocked(fetch).mockResolvedValue({ ok: false } as Response);
      const user = await openBucket(11);

      await user.click(screen.getByRole("button", { name: "Park" }));

      expect(setToasts).toHaveBeenCalledWith([
        expect.objectContaining({
          message: "Failed to update what you're working on",
          type: "error",
        }),
      ]);
      expect(refresh).not.toHaveBeenCalled();
    });
  });
});
