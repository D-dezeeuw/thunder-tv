import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
    MAT_DIALOG_DATA,
    MatDialog,
    MatDialogModule,
    MatDialogRef,
} from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe } from '@ngx-translate/core';
import {
    LiveChannelVariant,
    XtreamLiveChannelGroup,
} from '@iptvnator/portal/xtream/data-access';
import { XtreamLiveStream } from '@iptvnator/shared/interfaces';

export interface LiveChannelVariantDialogData {
    readonly group: XtreamLiveChannelGroup;
    readonly activeStreamId: number | null;
}

export type LiveChannelVariantDialogResult =
    | LiveChannelVariant<XtreamLiveStream>
    | undefined;

/**
 * Picker for the quality variants hidden behind a curated channel entry
 * (FHD/HD/4K/replay feeds of the same channel). Selecting a variant closes
 * the dialog with it; the host starts playback.
 */
@Component({
    selector: 'app-live-channel-variant-dialog',
    imports: [
        MatButtonModule,
        MatDialogModule,
        MatIconModule,
        MatTooltipModule,
        TranslatePipe,
    ],
    templateUrl: './live-channel-variant-dialog.component.html',
    styleUrl: './live-channel-variant-dialog.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LiveChannelVariantDialogComponent {
    private readonly dialogRef = inject(
        MatDialogRef<
            LiveChannelVariantDialogComponent,
            LiveChannelVariantDialogResult
        >
    );
    readonly data = inject<LiveChannelVariantDialogData>(MAT_DIALOG_DATA);

    readonly variants = computed(() => this.data.group.variants);

    static open(
        dialog: MatDialog,
        data: LiveChannelVariantDialogData
    ): MatDialogRef<
        LiveChannelVariantDialogComponent,
        LiveChannelVariantDialogResult
    > {
        return dialog.open(LiveChannelVariantDialogComponent, {
            data,
            width: '420px',
            maxHeight: '80vh',
        });
    }

    isActive(variant: LiveChannelVariant<XtreamLiveStream>): boolean {
        const activeId = this.data.activeStreamId;
        if (activeId === null) {
            return false;
        }
        return (
            Number(variant.stream.xtream_id ?? variant.stream.stream_id) ===
            activeId
        );
    }

    isHighBandwidth(variant: LiveChannelVariant<XtreamLiveStream>): boolean {
        return variant.qualityTier === 'uhd';
    }

    pick(variant: LiveChannelVariant<XtreamLiveStream>): void {
        this.dialogRef.close(variant);
    }
}
