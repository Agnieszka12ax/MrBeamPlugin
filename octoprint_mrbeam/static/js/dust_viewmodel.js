/**
 * Created by flo on 18/07/2017. Based on andy's ready_to_laser_viewmodel.js
 */
$(function() {
    function DustViewModel(params) {
        var self = this;
        self.loginState = params[0];
        self.state = params[1];
        self.laserCutterProfiles = params[2];

        self.dustvalue = ko.observable(0.0);

        self.onStartupComplete = function () {
            // this is listening for data coming through the socket connection
            self.onDataUpdaterPluginMessage = function(plugin, data) {
                if (plugin !== "mrbeam") {
                    return;
                }

                self._debugDaShit("onDataUpdaterPluginMessage() ", data);

                if (!data) {
                    console.warn("onDataUpdaterPluginMessage() received empty data for plugin '"+mrbeam+"'");
                    return;
                }

                if ('status' in data) {
                    self.dustvalue(data['status']['dust_value']);
                }
            };
        }; // end onStartupComplete
    }

    OCTOPRINT_VIEWMODELS.push([
        ReadyToLaserViewModel,
        ["loginStateViewModel", "printerStateViewModel", "laserCutterProfilesViewModel"],
        ["#dust_value"]
    ]);
});
/**
 * Created by flo on 7/18/17.
 */
