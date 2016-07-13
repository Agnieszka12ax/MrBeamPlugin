$(function(){

	function MotherViewModel(params) {
		var self = this;
		self.loginState = params[0];
		self.settings = params[1];
		self.state = params[2];
		self.gcodefiles = params[3];
		self.connection = params[4];
		self.control = params[5];
		self.terminal = params[6];
		self.workingArea = params[7];
		self.conversion = params[8];

		self.onStartup = function(){
			// TODO fetch machine profile on start
			//self.requestData(); 
			self.control.showZAxis = ko.computed(function(){
//				var has = self.currentProfileData()['zAxis']();
//				return has;
				return false;
			}); 
			
			self.control.setCoordinateOrigin = function () {
				self.control.sendCustomCommand({type: 'command', command: "G92 X0 Y0"});
			};
			
			self.control.jogDistanceInMM = ko.observable(undefined);
			
			self.control.manualPosition = function(){
						$('#manual_position').removeClass('warning');
				var s = $('#manual_position').val();
				var tmp = s.split(/[^0-9.,-\\+]+/);
				if (tmp.length === 2) {
					var x = parseFloat(tmp[0]);
					var y = parseFloat(tmp[1]);
					if(!isNaN(x) && !isNaN(y)) {
						self.control.sendCustomCommand({type: 'command', command: "G0X"+x+"Y"+y});
						$('#manual_position').val('');
					} else {
						$('#manual_position').addClass('warning');
					}
				} else {
					$('#manual_position').addClass('warning');
				}
			};
			
			// TODO forward to control viewmodel
			self.state.isLocked = ko.observable(undefined);
			self.state.isReady = ko.observable(undefined);
			self.state.isFlashing = ko.observable(undefined);
			self.state.currentPos = ko.observable(undefined);
			
			self.state.intensityOverride = ko.observable(100);
			self.state.feedrateOverride = ko.observable(100);
			self.state.intensityOverride.extend({ rateLimit: 500 });
			self.state.feedrateOverride.extend({ rateLimit: 500 });
			self.state.numberOfPasses = ko.observable(1);
			self.state.isConnecting = ko.observable(undefined);
			
			self.state.laserPos = ko.computed(function () {
				var pos = self.state.currentPos();
				if (!pos) {
					return "(?, ?)";
				} else {
					return "(" + pos.x + ", " + pos.y + ")";
				}
			}, this);
		};

		self.onAllBound = function(allViewModels) {
		  	var tabs = $('#mrbeam-main-tabs a[data-toggle="tab"]');
			tabs.on('show', function (e) {
				var current = e.target.hash;
				var previous = e.relatedTarget.hash;
				log.debug("Selected OctoPrint tab changed: previous = " + previous + ", current = " + current);
				OctoPrint.coreui.selectedTab = current;
				callViewModels(allViewModels, "onTabChange", [current, previous]);
		  	});

			tabs.on('shown', function (e) {
				var current = e.target.hash;
				var previous = e.relatedTarget.hash;
				callViewModels(allViewModels, "onAfterTabChange", [current, previous]);
			});
			
			self._configureOverrideSliders();
		};
		
		self.fromCurrentData = function(data) {
            self._fromData(data);
        };

        self.fromHistoryData = function(data) {
            self._fromData(data);
        };
		
		self._fromData = function (data) {
			self._processStateData(data.state);
			self._processWPosData(data.workPosition);
		};

		self._processStateData = function (data) {
			self.state.isLocked(data.flags.locked);
			self.state.isFlashing(data.flags.flashing);
			self.state.isConnecting(data.text === "Connecting" || data.text === "Opening serial port");
		};

		self._processWPosData = function (data) {
			if (data == null) {
				self.state.currentPos({x: 0, y: 0});
			} else {
				self.state.currentPos({x: data[0], y: data[1]});
			}
		};
		
		self._configureOverrideSliders = function() {
			self.state.intensityOverrideSlider = $("#intensity_override_slider").slider({
				step: 1,
				min: 10,
				max: 200,
				value: 100,
			}).on("slideStop", function(ev){
				self.state.intensityOverride(ev.value);
			});

			self.state.feedrateOverrideSlider = $("#feedrate_override_slider").slider({
				step: 1,
				min: 10,
				max: 200,
				value: 100,
			}).on("slideStop", function(ev){
				self.state.feedrateOverride(ev.value);
			});

		};
		
		self.state.resetOverrideSlider = function() {
            self.state.feedrateOverrideSlider.slider('setValue', 100);
			self.state.intensityOverrideSlider.slider('setValue', 100);
			self.state.intensityOverride(100);
			self.state.feedrateOverride(100);
		};
		
		
		// files.js viewmodel extensions
		
        self.gcodefiles.templateFor = function(data) {
			if(data.type === 'folder'){
				return 'files_template_folder';
			} else {
				return "files_template_" + data.typePath.join('_');
			}
        };
		
		self.gcodefiles.startGcodeWithSafetyWarning = function(gcodeFile){
			self.gcodefiles.loadFile(gcodeFile, false);

			self.show_safety_glasses_warning(function(){
				self.gcodefiles.loadFile(gcodeFile, true);
			});
		};

		self.gcodefiles.takePhoto = function () {
				$('#take_photo_dialog').modal("show");
			};

		self.gcodefiles.hasCamera = function () {
				var fGetUserMedia = (
						navigator.getUserMedia ||
						navigator.webkitGetUserMedia ||
						navigator.mozGetUserMedia ||
						navigator.oGetUserMedia ||
						navigator.msieGetUserMedia ||
						false
						);
				return !!fGetUserMedia;
			};

		self.gcodefiles.onEventSlicingDone = function (payload) {
			var url = API_BASEURL + "files/" + payload.gcode_location + "/" + payload.gcode;
			var data = {refs: {resource: url}, origin: payload.gcode_location, path: payload.gcode};
			self.gcodefiles.loadFile(data, false); // loads gcode into gcode viewer

			var callback = function (e) {
				e.preventDefault();
				self.gcodefiles.loadFile(data, true); // starts print
			};
			self.show_safety_glasses_warning(callback);
		};
		
		// settings.js viewmodel extensions
		
		self.settings.saveall = function(e, v){
			$("#settingsTabs li.active").addClass('saveInProgress');
			if(self.settings.savetimer !== undefined){
				clearTimeout(self.settings.savetimer);
			}
			self.settings.savetimer = setTimeout(function () {
				self.settings.saveData(undefined, function () {
					$("#settingsTabs li.active").removeClass('saveInProgress');
					self.settings.savetimer = undefined;
				});
			}, 2000);
		};
		
		$('#settings_dialog_content').has('input, select, textarea').on('change', function(){
			self.settings.saveall();
		});

		self.terminal.onAfterTabChange = function(current, previous) {
            self.terminal.tabActive = current == "#mrb_term";
            self.terminal.updateOutput();
        };
		

		self.show_safety_glasses_warning = function (callback) {
			var options = {};
			options.title = gettext("Are you sure?");
			options.message = gettext("The laser will now start. Protect yourself and everybody in the room appropriately before proceeding!");
			options.question = gettext("Are you sure you want to proceed?");
			options.cancel = gettext("Cancel");
			options.proceed = gettext("Proceed");
			options.proceedClass = "danger";
			options.dialogClass = "safety_glasses_heads_up";
			options.onproceed = function (e) {
						if (typeof callback === 'function') {
                            self.state.resetOverrideSlider();
                            self.state.numberOfPasses(1);
							callback(e);
						}
					};
			showConfirmationDialog(options);
		};

		self.print_with_safety_glasses_warning = function () {
			var callback = function (e) {
				e.preventDefault();
				self.print();
			};
			self.show_safety_glasses_warning(callback);
		};
	}
	
	
	// view model class, parameters for constructor, container to bind to
    ADDITIONAL_VIEWMODELS.push([MotherViewModel,
		["loginStateViewModel", "settingsViewModel", "printerStateViewModel",  "gcodeFilesViewModel",
		"connectionViewModel", "controlViewModel", "terminalViewModel", "workingAreaViewModel", "vectorConversionViewModel"],
		[document.getElementById("mrb_state"), 
			document.getElementById("mrb_control"),
			document.getElementById("mrb_connection_wrapper"),
			document.getElementById("mrb_state_wrapper"),
			document.getElementById("mrb_term"),
			document.getElementById("focus")
		]]);

	// third party model binding
	OCTOPRINT_ADDITIONAL_BINDINGS.push(['gcodeFilesViewModel', ["#design_lib_search"]]);
});

