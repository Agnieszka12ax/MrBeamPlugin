$(function () {
    function AnalyticsViewModel(params) {
        let self = this;
        window.mrbeam.viewModels["analyticsViewModel"] = self;
        self.settings = params[0];

        self.window_load_ts = -1;

        // Do not use before onStartupComplete!
        self.analyticsEnabled = ko.observable(false);
        self.isStartupComplete = false;
        self.error_sqeuence = 0;

        self.send_fontend_event = function (event, payload) {
            if (self.isStartupComplete && !self.analyticsEnabled()) {
                return {};
            }

            return self._send(event, payload, "analytics");
        };

        self.send_console_event = function (logData) {
            // copies logData to not pollute console.everything
            logData = { ...logData };
            if (logData.level == "error" || logData.level == "warn") {
                logData.error_sqeuence = self.error_sqeuence++;
            }
            return self._send("console", logData, "console");
        };

        self._send = function (event, payload, endpoint) {
            payload = payload || {};
            payload["ts"] = payload["ts"] || new Date().getTime();
            payload["browser_time"] = new Date().toLocaleString("en-GB"); //GB so that we don't get AM/PM

            let data = {
                event: event,
                payload: payload,
            };

            return $.ajax({
                url: "plugin/mrbeam/" + endpoint,
                type: "POST",
                dataType: "json",
                contentType: "application/json; charset=UTF-8",
                data: JSON.stringify(data),
            });
        };

        $(window).load(function () {
            self.window_load_ts = new Date().getTime();
        });

        self.onAllBound = function () {
            self._updateAnalyticsEnabledValue();

            if (console.everything) {
                console.everything.forEach(function (logData) {
                    if (
                        logData.level == "log" ||
                        logData.level == "error" ||
                        logData.level == "warn"
                    ) {
                        self.send_console_event(logData);
                    }
                });

                console.callbacks.error = self.send_console_event;
                console.callbacks.warn = self.send_console_event;
                console.callbacks.log = self.send_console_event;
            }
        };

        self.onStartupComplete = function () {
            self.isStartupComplete = true;
        };

        self.onEventSettingsUpdated = function () {
            self._updateAnalyticsEnabledValue();
        };

        self.onCurtainOpening = function () {
            let now = new Date().getTime();
            let payload = {
                window_load: (self.window_load_ts - INIT_TS_MS) / 1000,
                curtain_open: (now - INIT_TS_MS) / 1000,
            };
            console.log(
                "Loading duration - window_load: " +
                    payload["window_load"] +
                    ", curtain_open: " +
                    payload["curtain_open"]
            );
            self.send_fontend_event("loading_dur", payload);
        };

        self._updateAnalyticsEnabledValue = function () {
            self.analyticsEnabled(
                self.settings.settings.plugins.mrbeam.analyticsEnabled()
            );
        };
    }

    // view model class, parameters for constructor, container to bind to
    OCTOPRINT_VIEWMODELS.push([
        AnalyticsViewModel,

        // e.g. loginStateViewModel, settingsViewModel, ...
        ["settingsViewModel"],

        // e.g. #settings_plugin_mrbeam, #tab_plugin_mrbeam, ...
        [],
    ]);
});
