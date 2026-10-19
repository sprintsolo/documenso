# Clara patches for Documenso

This repository is a public fork of [documenso/documenso](https://github.com/documenso/documenso), licensed under the GNU Affero General Public License v3.0 (AGPL-3.0). It holds the source of the patched Documenso builds that Clara runs. Upstream copyright, branding and license notices are kept unchanged.

This branch (`clara/ci`) contains only this file and the image build workflow. The patched source lives on `clara/v<upstream version>` branches and `v<upstream version>-clara.<n>` tags.

## Current release

| Item | Value |
| --- | --- |
| Upstream release | `v2.17.0` (`75330166cc00b29c14399bc2e391e4b4d8080c00`) |
| Patch branch | `clara/v2.17.0` |
| Release tag | `v2.17.0-clara.1` |
| Image | `ghcr.io/sprintsolo/documenso:v2.17.0-clara.1` (linux/amd64) |

## Patches

### 1. Edit signed signature and text fields on click

Commit: `feat(clara): edit signed signature/text fields on click` on `clara/v2.17.0`.

- **Problem:** in the envelope (v2) signing view, clicking a signed signature field or an entered text field cleared it. Changing a value took a clear click plus a second click, and for signatures the sidebar signature had to be edited first.
- **Change:** signed fields open their dialog prefilled with the current value. Sign/Enter overwrites it, Cancel keeps it, and a new Clear button removes it. Unsigned fields behave as before: the saved signature is still inserted directly. Date fields stay prefilled and read only.
- **Fix included:** the signer renderer redrew a field only when `inserted` or `customText` changed, so an overwritten signature stayed on screen. The render cache now also compares the signature value.
- **Test:** `packages/app-tests/e2e/envelopes/envelope-signing-click-to-edit.spec.ts`.
- **Files:** `apps/remix/app/utils/field-signing/{signature,text}-field.ts`, `apps/remix/app/components/dialogs/sign-field-{signature,text}-dialog.tsx`, `apps/remix/app/components/dialogs/sign-field-dialog-result.ts`, `apps/remix/app/components/general/envelope-signing/envelope-signer-page-renderer.tsx`, `packages/lib/translations/ko/web.po`.

## Moving to a new upstream release

1. Create `clara/v<new>` from the upstream tag `v<new>`.
2. Cherry-pick each patch commit above and resolve conflicts.
3. Run `npm run typecheck -w @documenso/remix` and the e2e spec above against a local build.
4. Tag `v<new>-clara.1`, then run the **Clara image** workflow with that tag.
5. Pin the printed `DOCUMENSO_IMAGE=…@sha256:…` line in the deployment, and update this file.

## Fork policy

- Every upstream workflow is disabled in this fork. Only **Clara image** runs.
- Images are built for `linux/amd64` only, without upstream telemetry credentials.
