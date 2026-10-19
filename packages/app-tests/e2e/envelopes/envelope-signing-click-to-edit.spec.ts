import { prisma } from '@documenso/prisma';
import { type Field, FieldType } from '@documenso/prisma/client';
import { seedPendingDocumentWithFullFields } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';
import { expect, type Page, test } from '@playwright/test';

import { signSignaturePad } from '../fixtures/signature';

test.describe.configure({ mode: 'parallel' });

const seedSigningRecipient = async () => {
  const { user, team } = await seedUser();

  const { recipients } = await seedPendingDocumentWithFullFields({
    owner: user,
    recipients: ['click-to-edit@test.documenso.com'],
    fields: [FieldType.SIGNATURE, FieldType.TEXT, FieldType.DATE],
    updateDocumentOptions: { internalVersion: 2 },
    teamId: team.id,
  });

  const recipient = recipients[0];

  const fieldOfType = (type: FieldType) => {
    const field = recipient.fields.find((f) => f.type === type);

    if (!field) {
      throw new Error(`Seeded recipient has no ${type} field`);
    }

    return field;
  };

  return {
    recipient,
    signatureField: fieldOfType(FieldType.SIGNATURE),
    textField: fieldOfType(FieldType.TEXT),
    dateField: fieldOfType(FieldType.DATE),
  };
};

const clickField = async (page: Page, field: Field) => {
  const canvas = page.locator('.konva-container canvas').first();
  await expect(canvas).toBeVisible();

  const box = await canvas.boundingBox();

  if (!box) {
    throw new Error('Signing canvas has no bounding box');
  }

  await canvas.click({
    position: {
      x: (box.width * (Number(field.positionX) + Number(field.width) / 2)) / 100,
      y: (box.height * (Number(field.positionY) + Number(field.height) / 2)) / 100,
    },
  });
};

const expectFieldState = async (fieldId: number, expected: { inserted: boolean; customText?: string }) => {
  await expect(async () => {
    const field = await prisma.field.findUniqueOrThrow({ where: { id: fieldId } });

    expect(field.inserted).toBe(expected.inserted);

    if (expected.customText !== undefined) {
      expect(field.customText).toBe(expected.customText);
    }
  }).toPass({ timeout: 10_000 });
};

const expectTypedSignature = async (fieldId: number, typedSignature: string | null) => {
  await expect(async () => {
    const signature = await prisma.signature.findFirst({ where: { fieldId } });

    expect(signature?.typedSignature ?? null).toBe(typedSignature);
  }).toPass({ timeout: 10_000 });
};

const openSigningPage = async (page: Page, token: string) => {
  await page.goto(`/sign/${token}`);
  await expect(page.locator('.konva-container canvas').first()).toBeVisible();
};

const signatureDialog = (page: Page) => page.getByRole('dialog').filter({ hasText: 'Sign Signature Field' });

const insertSavedSignature = async (page: Page, signatureField: Field) => {
  await signSignaturePad(page);
  await clickField(page, signatureField);
  await expectFieldState(signatureField.id, { inserted: true });
  await expectTypedSignature(signatureField.id, 'Signature');
};

test('[CLICK_TO_EDIT]: unsigned signature field takes the saved signature without a dialog', async ({ page }) => {
  const { recipient, signatureField } = await seedSigningRecipient();

  await openSigningPage(page, recipient.token);
  await insertSavedSignature(page, signatureField);

  await expect(signatureDialog(page)).toHaveCount(0);
});

test('[CLICK_TO_EDIT]: signed signature field opens a prefilled dialog and overwrites on sign', async ({ page }) => {
  const { recipient, signatureField } = await seedSigningRecipient();

  await openSigningPage(page, recipient.token);
  await insertSavedSignature(page, signatureField);

  await clickField(page, signatureField);

  const dialog = signatureDialog(page);
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Sign', exact: true })).toBeEnabled();

  await dialog.getByRole('tab', { name: 'Type' }).click();
  await dialog.getByTestId('signature-pad-type-input').fill('Edited Signature');
  await dialog.getByRole('button', { name: 'Sign', exact: true }).click();

  await expectFieldState(signatureField.id, { inserted: true });
  await expectTypedSignature(signatureField.id, 'Edited Signature');

  // Reopening shows the overwritten signature, so the field was redrawn with its new value.
  await clickField(page, signatureField);
  await dialog.getByRole('tab', { name: 'Type' }).click();
  await expect(dialog.getByTestId('signature-pad-type-input')).toHaveValue('Edited Signature');
});

test('[CLICK_TO_EDIT]: cancelling the edit dialog keeps the signed signature', async ({ page }) => {
  const { recipient, signatureField } = await seedSigningRecipient();

  await openSigningPage(page, recipient.token);
  await insertSavedSignature(page, signatureField);

  await clickField(page, signatureField);

  const dialog = signatureDialog(page);
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button', { name: 'Cancel' }).click();
  await expect(dialog).toHaveCount(0);

  await expectFieldState(signatureField.id, { inserted: true });
  await expectTypedSignature(signatureField.id, 'Signature');
});

test('[CLICK_TO_EDIT]: clear in the signature dialog removes the signature', async ({ page }) => {
  const { recipient, signatureField } = await seedSigningRecipient();

  await openSigningPage(page, recipient.token);
  await insertSavedSignature(page, signatureField);

  await clickField(page, signatureField);

  const dialog = signatureDialog(page);
  await expect(dialog).toBeVisible();
  await dialog.getByTestId('sign-field-clear-button').click();

  await expectFieldState(signatureField.id, { inserted: false });
  await expectTypedSignature(signatureField.id, null);
});

test('[CLICK_TO_EDIT]: entered text field opens a prefilled dialog and overwrites on enter', async ({ page }) => {
  const { recipient, textField } = await seedSigningRecipient();

  await openSigningPage(page, recipient.token);

  await clickField(page, textField);
  await page.getByRole('dialog').getByRole('textbox').fill('First value');
  await page.getByRole('dialog').getByRole('button', { name: 'Enter' }).click();
  await expectFieldState(textField.id, { inserted: true, customText: 'First value' });

  await clickField(page, textField);

  const textbox = page.getByRole('dialog').getByRole('textbox');
  await expect(textbox).toHaveValue('First value');
  await textbox.fill('Second value');
  await page.getByRole('dialog').getByRole('button', { name: 'Enter' }).click();

  await expectFieldState(textField.id, { inserted: true, customText: 'Second value' });
});

test('[CLICK_TO_EDIT]: clear in the text dialog removes the text', async ({ page }) => {
  const { recipient, textField } = await seedSigningRecipient();

  await openSigningPage(page, recipient.token);

  await clickField(page, textField);
  await page.getByRole('dialog').getByRole('textbox').fill('First value');
  await page.getByRole('dialog').getByRole('button', { name: 'Enter' }).click();
  await expectFieldState(textField.id, { inserted: true, customText: 'First value' });

  await clickField(page, textField);
  await page.getByRole('dialog').getByTestId('sign-field-clear-button').click();

  await expectFieldState(textField.id, { inserted: false });
});

test('[CLICK_TO_EDIT]: date field stays prefilled and read only', async ({ page }) => {
  const { recipient, dateField } = await seedSigningRecipient();

  await openSigningPage(page, recipient.token);

  await clickField(page, dateField);

  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expectFieldState(dateField.id, { inserted: false });
});
