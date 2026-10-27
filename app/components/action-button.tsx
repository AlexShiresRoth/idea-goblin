"use client";
type Props = {
  action: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  testId?: string;
};

export default function ActionButton({
  action,
  children,
  disabled,
  testId,
}: Props) {
  return (
    <button
      className="action-button"
      onClick={action}
      disabled={disabled}
      data-testid={testId}
    >
      {children}
    </button>
  );
}
