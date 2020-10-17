/**
 * API OWENR: 墨蛰
 */

declare module 'vscode' {
  /**
   * Namespace describing the environment the editor runs in.
   */
  export namespace env {

    /**
     * The application name of the editor, like 'VS Code'.
     */
    export const appName: string;

    /**
     * The application root folder from which the editor is running.
     */
    export const appRoot: string;

    /**
     * The custom uri scheme the editor registers to in the operating system.
     */
    export const uriScheme: string;

    /**
     * Represents the preferred user-language, like `de-CH`, `fr`, or `en-US`.
     */
    export const language: string;

    /**
     * The system clipboard.
     */
    export const clipboard: Clipboard;

    /**
     * A unique identifier for the computer.
     */
    export const machineId: string;

    /**
     * A unique identifier for the current session.
     * Changes each time the editor is started.
     */
    export const sessionId: string;

    /**
     * The name of a remote. Defined by extensions, popular samples are `wsl` for the Windows
     * Subsystem for Linux or `ssh-remote` for remotes using a secure shell.
     *
     * *Note* that the value is `undefined` when there is no remote extension host but that the
     * value is defined in all extension hosts (local and remote) in case a remote extension host
     * exists. Use [`Extension#extensionKind`](#Extension.extensionKind) to know if
     * a specific extension runs remote or not.
     */
    export const remoteName: string | undefined;

    /**
     * The UI kind property indicates from which UI extensions
     * are accessed from. For example, extensions could be accessed
     * from a desktop application or a web browser.
     */
    export const uiKind: UIKind;

    /**
     * The detected default shell for the extension host, this is overridden by the
     * `terminal.integrated.shell` setting for the extension host's platform.
     */
    export const shell: string;

    /**
     * Opens an *external* item, e.g. a http(s) or mailto-link, using the
     * default application.
     *
     * *Note* that [`showTextDocument`](#window.showTextDocument) is the right
     * way to open a text document inside the editor, not this function.
     *
     * @param target The uri that should be opened.
     * @returns A promise indicating if open was successful.
     */
    export function openExternal(target: Uri): Thenable<boolean>;
  }

}
