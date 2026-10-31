import Uppy, { type Meta, type UploadResult, type UppyFile } from '@uppy/core';
import StatusBar from '@uppy/status-bar';
import XHRUpload from '@uppy/xhr-upload';
import { z } from 'zod';
import { bytesToSize } from '@/shared/lib/strings';
import { sanitizeHtml } from '@/shared/lib/utils';

/** Тело JSON ответа эндпоинта загрузки (см. бэкенд). */
type XhrUploadResponseBody = {
    data?: {
        items?: number[];
    };
};

type UploaderFile = UppyFile<Meta, XhrUploadResponseBody>;

const allowedFileTypesSchema = z.array(z.string());

type AllowedFileTypes = z.infer<typeof allowedFileTypesSchema>;

function parseJson(raw: string): unknown {
    try {
        const value: unknown = JSON.parse(raw);

        return value;
    } catch (error) {
        if (!(error instanceof SyntaxError)) throw error;

        return undefined;
    }
}

function parseAllowedFileTypes(raw: string | undefined): AllowedFileTypes | undefined {
    if (!raw) return undefined;

    const parsed = allowedFileTypesSchema.safeParse(parseJson(raw));

    return parsed.success ? parsed.data : undefined;
}

const EVENTS = {
    UPLOAD_START: 'fileuploader:upload-start',
    UPLOAD_COMPLETE: 'fileuploader:upload-complete',
    FILE_UPLOADED: 'fileuploader:file-uploaded',
    FILE_DELETED: 'fileuploader:file-deleted',
} as const;

type FileUploaderEventDetail = {
    [EVENTS.UPLOAD_START]: {
        uploadId: string;
        files: UploaderFile[];
    };
    [EVENTS.UPLOAD_COMPLETE]: {
        result: UploadResult<Meta, XhrUploadResponseBody>;
    };
    [EVENTS.FILE_UPLOADED]: {
        file: UploaderFile;
        ids: number[];
        response: NonNullable<UploaderFile['response']>;
    };
    [EVENTS.FILE_DELETED]: {
        uppyId: string | undefined;
    };
};

export function init(container: Element | Document = document) {
    const fileUploaders = container.querySelectorAll<HTMLDivElement>('.js-file-uploader');

    fileUploaders.forEach((fileUploader) => {
        let errorState = false;

        function updateErrorClass() {
            const isValid = fileUploader?.dataset.valid === 'true';
            const isError = !isValid || errorState;

            fileUploader?.classList.toggle('is-error', isError);

            const input = fileUploader?.querySelector('.js-file-input');
            const label = fileUploader?.querySelector('.js-file-uploader-label');

            if (input) input.classList.toggle('is-error', isError);

            if (label) label.classList.toggle('is-error', isError);
        }

        const observer = new MutationObserver((mutations) => {
            for (const m of mutations) {
                if (m.attributeName === 'data-valid') {
                    updateErrorClass();
                }
            }
        });

        observer.observe(fileUploader, { attributes: true });

        updateErrorClass();

        const inputId = fileUploader.dataset.uploaderId;
        const fieldName = fileUploader.dataset.fieldName;
        const endpoint = fileUploader.dataset.endpoint || '';
        const allowedTypes = parseAllowedFileTypes(fileUploader.dataset.allowedTypes);
        const maxFiles = Number(fileUploader.dataset.maxFiles);

        const fileInput = fileUploader.querySelector('.js-file-input');
        const statusBarTarget = `#${inputId}-status-bar`;
        let listEl: HTMLUListElement | null = null;

        function dispatchEvent<Name extends keyof FileUploaderEventDetail>(
            eventName: Name,
            detail: FileUploaderEventDetail[Name],
        ): void {
            fileUploader?.dispatchEvent(
                new CustomEvent(eventName, {
                    detail,
                    bubbles: true,
                    cancelable: true,
                }),
            );
        }

        function createList() {
            if (!listEl) {
                listEl = document.createElement('ul');
                listEl.className = 'file-uploader-list js-file-uploader-list list-unstyled';
                const bottom = fileUploader?.querySelector('.js-file-uploader-bottom');

                bottom?.insertBefore(listEl, bottom.firstChild);

                listEl?.addEventListener('click', (event) => {
                    if (!(event.target instanceof Element)) return;

                    const btn = event.target.closest('button');

                    if (!btn) return;

                    const li = btn.closest('li');

                    if (!li) return;

                    const uppyId = li.dataset.uppyId;

                    if (uppyId) {
                        uppy.removeFile(uppyId);
                    }

                    dispatchEvent(EVENTS.FILE_DELETED, {
                        uppyId,
                    });

                    li.remove();
                });
            }

            return listEl;
        }

        const uppy = new Uppy<Meta, XhrUploadResponseBody>({
            autoProceed: true,
            restrictions: {
                maxNumberOfFiles: maxFiles,
                allowedFileTypes: allowedTypes,
                maxFileSize: 10 * 1024 ** 3,
            },
        })
            .use(XHRUpload, { endpoint, fieldName, bundle: false })
            .use(StatusBar, { target: statusBarTarget });

        uppy.on('file-added', (file) => {
            createList();
            const li = document.createElement('li');

            li.dataset.uppyId = file.id;
            li.className = 'file-uploader-list__item';
            const rowHtml = `
            <div class="file-uploader-file text-default">
              <div class="file-uploader-file__content">
                <div class="file-uploader-file__content-left">
                  <svg
                    width="12"
                    height="14"
                    viewBox="0 0 12 14"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    class="file-uploader-file__icon"
                  >
                    <rect
                      x="0.75"
                      y="0.75"
                      width="10.5"
                      height="12.5"
                      rx="1.25"
                      stroke="black"
                      stroke-width="1.5"
                      stroke-linejoin="round"
                    />
                    <path
                      d="M4 5H8"
                      stroke="black"
                      stroke-width="1.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                    <path
                      d="M4 8H6"
                      stroke="black"
                      stroke-width="1.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </div>
                <div class="file-uploader-file__content-right">
                  <div class="file-uploader-file__name">${file.name}</div>
                  <div class="file-uploader-file__size">${file.size && bytesToSize(file.size)}</div>
                </div>
              </div>
              <button type="button" class="file-uploader-file__remove-btn" aria-label="Удалить">
                <svg class="file-uploader-file__remove-icon" width="16" height="16" viewBox="0 0 16 16">
                  <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                </svg>
              </button>
            </div>`;

            li.innerHTML = sanitizeHtml(rowHtml);

            listEl?.append(li);
        });

        uppy.on('upload', (uploadId) => {
            const files = uppy.getFiles();

            dispatchEvent(EVENTS.UPLOAD_START, {
                uploadId,
                files,
            });
        });

        uppy.on('upload-success', (file, response) => {
            if (!file) return;
            const items = response.body?.data?.items ?? [];

            items.forEach((item) => {
                const li = listEl?.querySelector<HTMLLIElement>(`li[data-uppy-id="${file.id}"]`);

                if (li) li.dataset.backendId = String(item);
            });
            dispatchEvent(EVENTS.FILE_UPLOADED, {
                file,
                ids: items,
                response,
            });
        });

        uppy.on('complete', (result) => {
            errorState = (result.failed?.length || 0) > 0;
            updateErrorClass();
            dispatchEvent(EVENTS.UPLOAD_COMPLETE, {
                result,
            });
        });

        uppy.on('upload-error', (_, error) => {
            // eslint-disable-next-line no-console
            console.error('Upload error', error);
            errorState = true;
            updateErrorClass();
        });

        fileInput?.addEventListener('change', (event) => {
            if (!(event.target instanceof HTMLInputElement) || !event.target.files) return;

            Array.from(event.target.files).forEach((file) => {
                uppy.addFile({ name: file.name, type: file.type, data: file });
            });
        });
    });
}

export default { init };
