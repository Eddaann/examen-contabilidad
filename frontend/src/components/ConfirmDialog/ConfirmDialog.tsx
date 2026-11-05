import { useEffect, useRef } from "react";
import Button from "../Button";
import "./ConfirmDialog.scss";

interface ConfirmDialogProps {
  open: boolean;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  loading,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  function handleCancel(event: React.SyntheticEvent<HTMLDialogElement>) {
    if (loading) {
      event.preventDefault();
      return;
    }

    onCancel();
  }

  return (
    <dialog
      ref={dialogRef}
      className="confirm-dialog"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-description"
      onCancel={handleCancel}
      onClose={() => {
        if (!loading && open) onCancel();
      }}
    >
      <div className="confirm-dialog__content">
        <span className="confirm-dialog__tag">
          Confirmación
        </span>

        <h2
          className="confirm-dialog__title"
          id="confirm-dialog-title"
        >
          ¿Finalizar examen?
        </h2>

        <p
          className="confirm-dialog__description"
          id="confirm-dialog-description"
        >
          Una vez enviado, no podrás modificar tus respuestas
          ni presentar el examen nuevamente.
        </p>

        <div className="confirm-dialog__actions">
          <Button
            className="confirm-dialog__button confirm-dialog__button--secondary"
            type="button"
            onClick={onCancel}
            disabled={loading}
          >
            Seguir revisando
          </Button>

          <Button
            className="confirm-dialog__button confirm-dialog__button--primary"
            type="button"
            onClick={onConfirm}
            loading={loading}
            loadingLabel="Enviando..."
          >
            Enviar examen
          </Button>
        </div>
      </div>
    </dialog>
  );
}
