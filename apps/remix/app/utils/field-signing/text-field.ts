import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { TFieldText } from '@documenso/lib/types/field';
import type { TSignEnvelopeFieldValue } from '@documenso/trpc/server/envelope-router/sign-envelope-field.types';
import { FieldType } from '@prisma/client';

import { SIGN_FIELD_DIALOG_CLEARED } from '~/components/dialogs/sign-field-dialog-result';
import { SignFieldTextDialog } from '~/components/dialogs/sign-field-text-dialog';

type HandleTextFieldClickOptions = {
  field: TFieldText;
  text: string | null;
};

export const handleTextFieldClick = async (
  options: HandleTextFieldClickOptions,
): Promise<Extract<TSignEnvelopeFieldValue, { type: typeof FieldType.TEXT }> | null> => {
  const { field, text } = options;

  if (field.type !== FieldType.TEXT) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Invalid field type',
    });
  }

  // An entered field opens the dialog prefilled with its current text so it can be edited in place.
  if (field.inserted) {
    const editedText = await SignFieldTextDialog.call({
      fieldMeta: field.fieldMeta,
      initialText: field.customText,
      allowClear: true,
    });

    if (editedText === null) {
      return null;
    }

    return {
      type: FieldType.TEXT,
      value: editedText === SIGN_FIELD_DIALOG_CLEARED ? null : editedText,
    };
  }

  let textToInsert = text;

  if (!textToInsert) {
    textToInsert = await SignFieldTextDialog.call({
      fieldMeta: field.fieldMeta,
    });
  }

  if (!textToInsert) {
    return null;
  }

  return {
    type: FieldType.TEXT,
    value: textToInsert,
  };
};
