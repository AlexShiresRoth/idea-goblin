"use client";
type Props = {
  action: () => void;
  children: React.ReactNode;
  disabled?: boolean;
};

export default function ActionButton({ action, children, disabled }: Props) {
  return (
    <button className="action-button" onClick={action} disabled={disabled}>
      {children}
    </button>
  );
}
