import {
    ChangeDetectionStrategy,
    Component,
    inject,
    OnInit,
    signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { TranslatePipe } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { PlaylistActions } from '@iptvnator/m3u-state';
import { PlaylistsService } from '@iptvnator/services';
import { Playlist } from '@iptvnator/shared/interfaces';
import { v4 as uuid } from 'uuid';
import {
    findMatchingXtreamPlaylist,
    parseXtreamConnectParams,
    XtreamConnectParams,
    XtreamConnectSection,
} from './xtream-connect.util';

type ConnectState = 'connecting' | 'error';
type ConnectErrorReason = 'missing-fields' | 'invalid-url' | 'failed';

/**
 * Bookmarkable deep-link entry point. `/connect?serverUrl=..&username=..&
 * password=..` imports the Xtream portal on first use, then reuses the
 * already-imported portal on every later visit, and navigates straight
 * into it (optionally to a `section` of live/vod/series). Credentials never
 * leave the client beyond the normal import flow; on a reused portal the
 * credential-bearing URL is replaced in history so it does not linger.
 */
@Component({
    selector: 'app-xtream-connect-route',
    imports: [
        MatButtonModule,
        MatIcon,
        MatProgressSpinnerModule,
        RouterLink,
        TranslatePipe,
    ],
    templateUrl: './xtream-connect-route.component.html',
    styleUrl: './xtream-connect-route.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class XtreamConnectRouteComponent implements OnInit {
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly store = inject(Store);
    private readonly playlistsService = inject(PlaylistsService);

    readonly state = signal<ConnectState>('connecting');
    readonly errorReason = signal<ConnectErrorReason>('missing-fields');

    async ngOnInit(): Promise<void> {
        const parsed = parseXtreamConnectParams(
            this.route.snapshot.queryParamMap
        );
        if (!parsed.ok) {
            this.fail(parsed.reason);
            return;
        }

        try {
            await this.connect(parsed.params);
        } catch (error) {
            // Never log the credential-bearing params themselves.
            console.error('Failed to connect via URL parameters', error);
            this.fail('failed');
        }
    }

    private async connect(params: XtreamConnectParams): Promise<void> {
        const playlists = await firstValueFrom(
            this.playlistsService.getAllPlaylists()
        );
        const existing = findMatchingXtreamPlaylist(
            playlists,
            params.serverUrl,
            params.username
        );

        if (existing?._id) {
            // Reuse the imported portal; replace the credential URL in
            // history so it does not stay in the address bar / back stack.
            this.navigateToPortal(existing._id, params.section, true);
            return;
        }

        // First import: the addPlaylist effect persists the portal and
        // navigates into it (portal root). A requested section applies on
        // subsequent visits, which take the reuse path above.
        this.store.dispatch(
            PlaylistActions.addPlaylist({
                playlist: {
                    _id: uuid(),
                    title: params.title,
                    serverUrl: params.serverUrl,
                    username: params.username,
                    password: params.password,
                    importDate: new Date().toISOString(),
                } as Playlist,
            })
        );
    }

    private navigateToPortal(
        playlistId: string,
        section: XtreamConnectSection | null,
        replaceUrl: boolean
    ): void {
        const commands = section
            ? ['/workspace', 'xtreams', playlistId, section]
            : ['/workspace', 'xtreams', playlistId];
        void this.router.navigate(commands, { replaceUrl });
    }

    private fail(reason: ConnectErrorReason): void {
        this.errorReason.set(reason);
        this.state.set('error');
    }
}
