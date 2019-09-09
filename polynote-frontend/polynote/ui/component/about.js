"use strict";

import {button, div, dropdown, h2, h3, iconButton, span, table, tag} from "../util/tags";
import {FullScreenModal} from "./modal";
import {TabNav} from "./tab_nav";
import {getHotkeys} from "../util/hotkeys";
import {preferences, storage} from "../util/storage";
import { UIEvent } from '../util/ui_event';
import {CallbackEvent} from "../util/ui_event";

export class About extends FullScreenModal {
    constructor() {
        super(
            div([], []),
            { windowClasses: ['about'] }
        );

        this.storageUpdateListeners = [];
    }

    aboutMain() {
        const el = div(["about-display"], [
            div([], [
                tag('img', [], {src: "/style/polynote.svg", alt:"Polynote"}, []),
                h2([], ["About this Polynote Server"])
            ])
        ]);

        this.request('ServerVersion', (version, commit) => {
            const info = [
                ["Server Version", version],
                ["Server Commit", commit]
            ];
            const tableEl = table(['server-info'], {
                header: false,
                classes: ['key', 'val'],
                rowHeading: false,
                addToTop: false
            });
            for (const [k, v] of info) {
                tableEl.addRow({
                    key: k,
                    val: v
                })
            }

            el.appendChild(tableEl);
        });
        return el;
    }

    hotkeys() {
        const hotkeys = getHotkeys();
        const el = div(["hotkeys-display"], [
            div([], [
                h2([], ["Press these buttons to do things"])
            ])
        ]);

        for (const [context, kvs] of Object.entries(hotkeys)) {
            el.appendChild(h3([], [context]));
            const tableEl = table([], {
                header: false,
                classes: ['key', 'val'],
                rowHeading: false,
                addToTop: false
            });
            for (const [k, v] of Object.entries(kvs)) {
                tableEl.addRow({
                    key: k,
                    val: v
                })
            }
            el.appendChild(tableEl);
        }

        return el;
    }

    preferences() {
        let storageInfoEl, preferencesEl;
        const el = div(["preferences-storage"], [
            div([], [
                h2([], ["UI Preferences and Storage"]),
                span([], ["The Polynote UI keeps some information in your browser's Local Storage, including some preferences you can configure yourself. "]),
                tag('br'),
                button(['clear'], {}, ['Clear All Preferences and Storage'])
                    .click(() => {
                        storage.clear();
                        location.reload();
                    }),
                tag('br'),
                h3([], ["Preferences"]),
                preferencesEl = div(['preferences'], []),
                h3([], ["Storage"]),
                span([], ["Here's everything Polynote is storing in local storage"]),
                storageInfoEl = div(['storage'], [])
            ])
        ]);

        const prefsTable = table([], {
            header: false,
            classes: ['key', 'val', 'desc'],
            rowHeading: false,
            addToTop: false
        });

        for (const [k, preference] of Object.entries(preferences.show())) {
            const value = preference.value;
            let valueEl;
            if (typeof value === "boolean") {
                valueEl = dropdown([], {true: "true", false: "false"}).change(evt => {
                    const self = evt.currentTarget;
                    const value = self.options[self.selectedIndex].value === "true";
                    preferences.set(k, value)
                });
                valueEl.value = value;
            }
            prefsTable.addRow({
                key: k,
                val: valueEl || value.toString(),
                desc: preference.description
            })
        }
        preferencesEl.appendChild(prefsTable);

        const storageTable = table([], {
            header: false,
            classes: ['key', 'val'],
            rowHeading: false,
            addToTop: false
        });

        for (const [k, v] of Object.entries(storage.show())) {
            const valueEl = div(['json'], []);

            const setValueEl = (value) => {
                monaco.editor.colorize(value, "json", {}).then(function(result) {
                    valueEl.innerHTML = result;
                });
            };
            setValueEl(v);

            storage.addStorageListener(k, (oldVal, newVal) => {
                if (newVal) setValueEl(newVal);
            });

            this.storageUpdateListeners.push(k);

            storageTable.addRow({
                key: k,
                val: valueEl
            })
        }
        storageInfoEl.appendChild(storageTable);

        return el;
    }

    runningKernels() {
        let content;
        const el = div(["running-kernels"], [
            div([], [
                h2([], ["Running Kernels"]),
                content = div([], ['Looks like no kernels are running now!'])
            ])
        ]);

        const getKernelStatuses = () => {
            this.request('RunningKernels', (statuses) => {
                const tableEl = table(['kernels'], {
                    header: ['path', 'status', 'actions'],
                    classes: ['path', 'status', 'actions'],
                    rowHeading: false,
                    addToTop: false
                });

                for (const status of statuses) {
                    const state = (status.update.busy && 'busy') || (!status.update.alive && 'dead') || 'idle';
                    const statusEl = span([], [
                        span(['status'], [state]),
                    ]);
                    const actionsEl = div([], [
                        iconButton(['start'], 'Start kernel', '', 'Start').click(() => {
                            this.dispatchEvent(new UIEvent('StartKernel', {path: status.path}));
                            getKernelStatuses();
                        }),
                        iconButton(['kill'], 'Kill kernel', '', 'Kill').click(() => {
                            this.dispatchEvent(new UIEvent('KillKernel', {path: status.path}));
                            getKernelStatuses();
                        }),
                        iconButton(['open'], 'Open notebook', '', 'Open').click(() => {
                            this.dispatchEvent(new UIEvent('LoadNotebook', {path: status.path}));
                            this.hide();
                        })
                    ]);

                    const rowEl = tableEl.addRow({
                        path: status.path,
                        status: statusEl,
                        actions: actionsEl
                    });
                    rowEl.classList.add('kernel-status', state)
                }

                if (statuses.length > 0) content.replaceChild(tableEl, content.firstChild);
            });
        };
        getKernelStatuses();

        return el;
    }

    show(section) {
        const tabs = {
            'About': this.aboutMain.bind(this),
            'Hotkeys': this.hotkeys.bind(this),
            'Preferences': this.preferences.bind(this),
            'Running Kernels': this.runningKernels.bind(this),
        };
        const tabnav = new TabNav(tabs);
        this.content.replaceChild(tabnav.container, this.content.firstChild);
        if (section) tabnav.showItem(section);

        super.show();
    }

    hide() {
        this.storageUpdateListeners.forEach(x => storage.clearStorageListener(x));
        super.hide()
    }
}