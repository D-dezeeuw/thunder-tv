type ElectronProcessWindow = Window & {
    process?: {
        type?: string;
    };
};

export interface ElectronRemoteProcess {
    argv: string[];
    platform:
        | 'aix'
        | 'android'
        | 'darwin'
        | 'freebsd'
        | 'haiku'
        | 'linux'
        | 'openbsd'
        | 'sunos'
        | 'win32'
        | 'cygwin'
        | 'netbsd'
        | string;
}

export interface ElectronRemote {
    app?: {
        getVersion: () => string;
    };
    process: ElectronRemoteProcess;
}

export abstract class DataService {
    get isElectron(): boolean {
        const currentWindow = window as ElectronProcessWindow;
        return Boolean(currentWindow.process?.type);
    }
    get remote(): ElectronRemote | null {
        return null;
    }
    get ipcRenderer() {
        return null;
    }
    abstract getAppVersion(): string;
    abstract sendIpcEvent<T = unknown>(
        type: string,
        payload?: unknown
    ): T | Promise<T>;
    abstract removeAllListeners(type: string): void;
    abstract listenOn(
        command: string,
        callback: (...args: unknown[]) => void
    ): void;
    abstract getAppEnvironment(): string;

    /**
     * Maps a direct provider stream URL to the URL the built-in players
     * should actually load. Electron plays streams directly (no CORS);
     * the PWA overrides this to route playback through the web backend's
     * `/stream` relay when the stream's origin belongs to a registered
     * provider target, so missing CORS headers on provider edges do not
     * break browser playback.
     */
    resolvePlaybackUrl(streamUrl: string): string {
        return streamUrl;
    }
}
