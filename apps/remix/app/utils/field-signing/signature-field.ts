import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { TFieldSignature } from '@documenso/lib/types/field';
import type { TSignEnvelopeFieldValue } from '@documenso/trpc/server/envelope-router/sign-envelope-field.types';
import { FieldType } from '@prisma/client';

import { SIGN_FIELD_DIALOG_CLEARED } from '~/components/dialogs/sign-field-dialog-result';
import { SignFieldSignatureDialog } from '~/components/dialogs/sign-field-signature-dialog';

type HandleSignatureFieldClickOptions = {
  field: TFieldSignature;
  fullName?: string;
  signature: string | null;
  currentSignature: string | null;
  typedSignatureEnabled?: boolean;
  uploadSignatureEnabled?: boolean;
  drawSignatureEnabled?: boolean;
};

export const handleSignatureFieldClick = async (
  options: HandleSignatureFieldClickOptions,
): Promise<Extract<TSignEnvelopeFieldValue, { type: typeof FieldType.SIGNATURE }> | null> => {
  const {
    field,
    fullName,
    signature,
    currentSignature,
    typedSignatureEnabled,
    uploadSignatureEnabled,
    drawSignatureEnabled,
  } = options;

  if (field.type !== FieldType.SIGNATURE) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Invalid field type',
    });
  }

  // A signed field opens the dialog prefilled with its current signature so it can be edited in place.
  if (field.inserted) {
    const editedSignature = await SignFieldSignatureDialog.call({
      fullName,
      initialSignature: currentSignature ?? undefined,
      allowClear: true,
      typedSignatureEnabled,
      uploadSignatureEnabled,
      drawSignatureEnabled,
    });

    if (editedSignature === null) {
      return null;
    }

    return {
      type: FieldType.SIGNATURE,
      value: editedSignature === SIGN_FIELD_DIALOG_CLEARED ? null : editedSignature,
    };
  }

  let signatureToInsert = signature;

  if (!signatureToInsert) {
    signatureToInsert = await SignFieldSignatureDialog.call({
      fullName,
      typedSignatureEnabled,
      uploadSignatureEnabled,
      drawSignatureEnabled,
    });
  }

  if (!signatureToInsert) {
    return null;
  }

  return {
    type: FieldType.SIGNATURE,
    value: signatureToInsert,
  };
};
