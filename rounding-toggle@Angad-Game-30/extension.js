const Main = imports.ui.main;
const Meta = imports.gi.Meta;
const Tweener = imports.ui.tweener;
let signalIds = [];

function init() {}

function enable() {
    try {
        // Tracks focus switches between applications
        signalIds.push({
            obj: global.display,
            id: global.display.connect('notify::focus-window', updatePanel)
        });

        // Cinnamon 5.4+ explicitly handles maximize tracking via the 'size-change' operation mask
        signalIds.push({
            obj: global.window_manager,
            id: global.window_manager.connect('size-change', (wm, actor, change) => {
                if (change === Meta.SizeChange.MAXIMIZE || change === Meta.SizeChange.UNMAXIMIZE) {
                    updatePanel();
                }
            })
        });
        
    } catch (e) {
        global.logError(e);
    }
    updatePanel();
}

function getPanelsList() {
    if (Main.panelManager && typeof Main.panelManager.getPanels === 'function') {
        return Main.panelManager.getPanels();
    }
    return Main.panelManager && Main.panelManager.panels ? Main.panelManager.panels : [];
}

function updatePanel() {
    try {
        let win = global.display.focus_window;
        let panels = getPanelsList();
        if (!panels) return;

        let isMaximized = false;
        if (win && typeof win.get_maximized === 'function') {
            isMaximized = (win.get_maximized() === (Meta.MaximizeFlags.HORIZONTAL | Meta.MaximizeFlags.VERTICAL));
        }

        panels.forEach(panel => {
            if (!panel) return;
            let actor = panel.actor || panel;
            
            if (actor && typeof actor.add_style_class_name === 'function') {
                
                // Clear any running panel animations
                Tweener.removeTweens(actor);
                
                // Reset scale so the texture doesn't stretch or warp anymore
                actor.scale_x = 1.0;
                if (typeof actor.set_pivot_point === 'function') {
                    actor.set_pivot_point(0.5, 0.5); 
                }

                // Create a temporary object to hold our animating margin numbers
                // If maximized: animate from 35 down to 0. If unmaximized: animate from 0 up to 35.
                let marginTracker = { currentMargin: isMaximized ? 35 : 0 };
                let targetMargin = isMaximized ? 0 : 35;

                // Animate the margin counter smoothly over 0.25 seconds
                Tweener.addTween(marginTracker, {
                    currentMargin: targetMargin,
                    time: 0.25,
                    transition: 'easeOutQuad', // Linear-smooth glide instead of an aggressive spring
                    onUpdate: () => {
                        // Frame-by-frame, inject the new margins directly into the panel's active inline style
                        let m = Math.round(marginTracker.currentMargin);
                        let r = isMaximized ? Math.round((m / 35) * 15) : 15; // Smoothly flattens radius too
                        
                        actor.set_style(`margin-left: ${m}px !important; margin-right: ${m}px !important; border-radius: ${r}px !important;`);
                        
                        if (typeof actor.queue_relayout === 'function') {
                            actor.queue_relayout();
                        }
                    },
                    onComplete: () => {
                        // Toggle the classes cleanly at the end of the slide
                        if (isMaximized) {
                            actor.add_style_class_name('maximized');
                            actor.set_style('margin-left: 0px !important; margin-right: 0px !important; border-radius: 0px !important;');
                        } else {
                            actor.remove_style_class_name('maximized');
                            actor.set_style(''); // Clear inline styles so your beautiful CSS takes over completely
                        }
                    }
                });

                if (panel._centerBox && typeof panel._centerBox.set_translation === 'function') {
                    panel._centerBox.set_translation(0, 0, 0);
                }
                
                let boxes = [panel._leftBox, panel._centerBox, panel._rightBox];
                boxes.forEach(box => {
                    if (box && typeof box.set_clip_to_allocation === 'function') {
                        box.set_clip_to_allocation(false);
                    }
                });
            }
        });
    } catch (e) {
        global.logError(e);
    }
}

function disable() {
    signalIds.forEach(s => {
        try { s.obj.disconnect(s.id); } catch (e) {}
    });
    signalIds = [];

    try {
        let panels = getPanelsList();
        if (panels) {
            panels.forEach(panel => {
                if (!panel) return;
                let actor = panel.actor || panel;
                
                Tweener.removeTweens(actor);
                if (actor && typeof actor.remove_style_class_name === 'function') {
                    actor.remove_style_class_name('maximized');
                    actor.set_style(''); // Restore default CSS rules instantly

                    if (panel._centerBox && typeof panel._centerBox.set_translation === 'function') {
                        panel._centerBox.set_translation(0, 0, 0);
                    }
                    
                    let boxes = [panel._leftBox, panel._centerBox, panel._rightBox];
                    boxes.forEach(box => {
                        if (box && typeof box.set_clip_to_allocation === 'function') {
                            box.set_clip_to_allocation(false);
                        }
                    });
                    
                    if (typeof actor.queue_relayout === 'function') {
                        actor.queue_relayout();
                    }
                }
            });
        }
    } catch (e) {
        global.logError(e);
    }
}












