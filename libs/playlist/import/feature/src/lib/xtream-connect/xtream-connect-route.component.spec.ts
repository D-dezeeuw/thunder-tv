import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { of } from 'rxjs';
import { PlaylistsService } from '@iptvnator/services';
import { XtreamConnectRouteComponent } from './xtream-connect-route.component';

function createComponent(options: {
    query: Record<string, string>;
    playlists: unknown[];
}): {
    component: XtreamConnectRouteComponent;
    router: { navigate: jest.Mock };
    store: { dispatch: jest.Mock };
} {
    const router = { navigate: jest.fn() };
    const store = { dispatch: jest.fn() };
    const route = {
        snapshot: {
            queryParamMap: { get: (key: string) => options.query[key] ?? null },
        },
    };
    const playlistsService = {
        getAllPlaylists: jest.fn(() => of(options.playlists)),
    };

    TestBed.configureTestingModule({
        providers: [
            { provide: ActivatedRoute, useValue: route },
            { provide: Router, useValue: router },
            { provide: Store, useValue: store },
            { provide: PlaylistsService, useValue: playlistsService },
        ],
    });

    const component = TestBed.runInInjectionContext(
        () => new XtreamConnectRouteComponent()
    );
    return { component, router, store };
}

describe('XtreamConnectRouteComponent', () => {
    afterEach(() => TestBed.resetTestingModule());

    it('reuses an existing portal and replaces the credential URL', async () => {
        const { component, router, store } = createComponent({
            query: {
                serverUrl: 'http://example.com:8080/player_api.php',
                username: 'user1',
                password: 'pass1',
                section: 'live',
            },
            playlists: [
                {
                    _id: 'existing-id',
                    serverUrl: 'http://example.com:8080',
                    username: 'user1',
                },
            ],
        });

        await component.ngOnInit();

        expect(store.dispatch).not.toHaveBeenCalled();
        expect(router.navigate).toHaveBeenCalledWith(
            ['/workspace', 'xtreams', 'existing-id', 'live'],
            { replaceUrl: true }
        );
        expect(component.state()).toBe('connecting');
    });

    it('imports a new portal when none matches', async () => {
        const { component, router, store } = createComponent({
            query: {
                serverUrl: 'http://new.example:8080',
                username: 'user1',
                password: 'pass1',
                title: 'My TV',
            },
            playlists: [],
        });

        await component.ngOnInit();

        expect(router.navigate).not.toHaveBeenCalled();
        expect(store.dispatch).toHaveBeenCalledTimes(1);
        const dispatched = store.dispatch.mock.calls[0][0];
        expect(dispatched.playlist).toMatchObject({
            title: 'My TV',
            serverUrl: 'http://new.example:8080',
            username: 'user1',
            password: 'pass1',
        });
        expect(dispatched.playlist._id).toBeTruthy();
    });

    it('shows a missing-fields error without touching the store', async () => {
        const { component, router, store } = createComponent({
            query: { serverUrl: 'http://example.com', username: 'user1' },
            playlists: [],
        });

        await component.ngOnInit();

        expect(store.dispatch).not.toHaveBeenCalled();
        expect(router.navigate).not.toHaveBeenCalled();
        expect(component.state()).toBe('error');
        expect(component.errorReason()).toBe('missing-fields');
    });

    it('shows an invalid-url error for an unsupported server URL', async () => {
        const { component } = createComponent({
            query: {
                serverUrl: 'ftp://example.com',
                username: 'user1',
                password: 'pass1',
            },
            playlists: [],
        });

        await component.ngOnInit();

        expect(component.state()).toBe('error');
        expect(component.errorReason()).toBe('invalid-url');
    });
});
