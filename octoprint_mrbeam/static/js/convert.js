$(function(){

	function VectorConversionViewModel(params) {
		var self = this;

		self.loginState = params[0];
		self.settings = params[1];
		self.state = params[2];
		self.workingArea = params[3];
		self.files = params[4];

		self.target = undefined;
		self.file = undefined;
		self.data = undefined;
		self.slicing_progress = ko.observable(0);
		self.slicing_in_progress = ko.observable(false);

		self.title = ko.observable(undefined);

		// expert settings
		self.showHints = ko.observable(false);
		self.showExpertSettings = ko.observable(false);
		self.gcodeFilename = ko.observable();
		self.pierceTime = ko.observable(0);

		// vector settings
		self.show_vector_parameters = ko.observable(true);
		self.maxSpeed = ko.observable(3000);
		self.minSpeed = ko.observable(20);


		// material menu
		//TODO make not hardcoded
		//[laserInt,speed,engraveWhite,engraveBlack,speedWhite,speedBlack]
		// TODO: should be a structure like this:
		
//		material = {
//			name: 'Kraftplex',
//			color: 'default',
//			engrave: {intensity: 300, feedrate: 500, pierceTime: 0, comment: '', rating: -1, rating_amount: 0}, // do we need passes here ?
//			cut: [
//				{thicknessMM:.8, intensity: 1000, feedrate: 120, pierceTime: 0, passes:1, comment: 'single pass, ugly edges', rating: -1, rating_amount: 0},
//				{thicknessMM:1.5, intensity: 1000, feedrate: 80, pierceTime: 0, passes:1, comment: 'single pass, ugly edges', rating: -1, rating_amount: 0},
//				{thicknessMM:1.5, intensity: 1000, feedrate: 240, pierceTime: 0, passes:3, comment: '3 faster passes, nice edges', rating: -1, rating_amount: 0},
//			],
//			description: 'natural MDF like material from Kraftplex.com',
//			hints: '',
//			safety_notes: 'super fine structures are subject to ignition!'
//			laser_type: 'MrBeamII-1.0'
//		}
		
		self.materials_settings = {
			'default':[0, 0, 0, 0, 0, 0],
//			'Acrylic':[1000,80,0,350,4500,850],
			'Foam Rubber':[625, 400, 0, 200, 3000, 1000],
			'Felt engrave':[300, 1000, 0, 300, 2000, 1000],
			'Felt cut':[1000, 1000, 0, 300, 2000, 1000],
			'Jeans Fabric':[1000,500,0,200,3000,500], // 2 passes todo check engraving
			'Grey cardboard':[1000,500,0,300,3000,750], // 2-3 passes
			'Cardboard':[1000,300,0,300,3000,750], // 2-3 passes
			'Kraftplex engrave':[400, 850, 0, 500, 3000, 850],
			'Kraftplex cut':[1000, 80, 0, 500, 3000, 850], //1-2 pass
			'Wood engrave':[350, 850, 0, 350, 3000, 850],
			'Wood cut':[1000, 250, 0, 350, 3000, 850],
			'Balsa cut':[700, 500, 0, 350, 3000, 850] //2 passes
		};
		var material_keys = [];
		for(var materialKey in self.materials_settings){
			material_keys.push(materialKey);
		}
		self.material_menu = ko.observableArray(material_keys);
		self.selected_material = ko.observable();
		self.old_material = 'default';

		// color settings
//		self.old_color = '';
//		self.selected_color = ko.observable();

		self.color_key_update = function(){
			var cols = self.workingArea.getUsedColors();
			
			for (var idx = 0; idx < cols.length; idx++) {
				var c = cols[idx];
				var exists = $('#cd_color_'+c.hex.substr(1)).length > 0;
				if(! exists){
					var drop_zone = $('#first_job .color_drop_zone');
					var i = self._getColorIcon(c);
					drop_zone.append(i);
				}
			}
		};
		
		self._getColorIcon = function(color){
			var i = $('<div/>',{
				id: 'cd_color_'+color.hex.substr(1),
				style: "background-color: "+color.hex+";",
				draggable: "true",
				class: 'used_color'
			}).on({ 
				dragstart: function(ev){ colorDrag(ev.originalEvent); },
				dragend: function(ev){ colorDragEnd(ev.originalEvent); }
			});
			
			return i;
		};
		
		self.set_material = function(material, ev){
			if(typeof ev !== 'undefined'){
				var param_set = self.materials_settings[material];
				var p = $(ev.target).parents('.job_row_vector');
				$(p).find('.job_title').html(material);
				$(p).find('.param_intensity').val(param_set[0]);
				$(p).find('.param_feedrate').val(param_set[1]);
				$(p).find('.param_passes').val(1); // currently no passes in the data structure
			}
		};
		
		// image engraving stuff
		// preset values are a good start for wood engraving
		self.images_placed = ko.observable(false);
		self.text_placed = ko.observable(false);
		self.filled_shapes_placed = ko.observable(false);
		self.engrave_outlines = ko.observable(false);
		
		self.show_image_parameters = ko.computed(function(){
			return (self.images_placed() || self.text_placed() || self.filled_shapes_placed());
		});
		self.imgIntensityWhite = ko.observable(0);
		self.imgIntensityBlack = ko.observable(500);
		self.imgFeedrateWhite = ko.observable(1500);
		self.imgFeedrateBlack = ko.observable(250);
		self.imgDithering = ko.observable(false);
		self.imgSharpening = ko.observable(1);
		self.imgContrast = ko.observable(1);
		self.beamDiameter = ko.observable(0.15);

		self.sharpeningMax = 25;
		self.contrastMax = 2;

		// preprocessing preview ... returns opacity 0.0 - 1.0
		self.sharpenedPreview = ko.computed(function(){
			if(self.imgDithering()) return 0;
			else {
				var sharpeningPercents = (self.imgSharpening() - 1)/(self.sharpeningMax - 1);
				var contrastPercents = (self.imgContrast() - 1)/(self.contrastMax - 1);
				return sharpeningPercents - contrastPercents/2;
			}
		}, self);
		self.contrastPreview = ko.computed(function(){
			if(self.imgDithering()) return 0;
			else {
				var sharpeningPercents = (self.imgSharpening() - 1)/(self.sharpeningMax - 1);
				var contrastPercents = (self.imgContrast() - 1)/(self.contrastMax - 1);
				return contrastPercents - sharpeningPercents/2;
			}
		}, self);


		self.maxSpeed.subscribe(function(val){
			self._configureFeedrateSlider();
		});

		// shows conversion dialog and extracts svg first
		self.show_conversion_dialog = function() {
			self.gcodeFilesToAppend = self.workingArea.getPlacedGcodes();
			self.show_vector_parameters(self.workingArea.getPlacedSvgs().length > 0);
			self.filled_shapes_placed(self.workingArea.hasFilledVectors());
			self.images_placed(self.workingArea.getPlacedImages().length > 0);
			self.text_placed(self.workingArea.hasTextItems());
			self.color_key_update();

			if(self.show_vector_parameters() || self.show_image_parameters()){

				var gcodeFile = self.create_gcode_filename(self.workingArea.placedDesigns());
				self.gcodeFilename(gcodeFile);

				self.title(gettext("Converting"));
				$("#dialog_vector_graphics_conversion").modal("show"); // calls self.convert() afterwards
			} else {
				// just gcodes were placed. Start lasering right away.
				self.convert();
			}
		};

		self.cancel_conversion = function(){
			if(self.slicing_in_progress()){
				// TODO cancel slicing at the backend properly
				self.slicing_in_progress(false);
			}
		};

		self.create_gcode_filename = function(placedDesigns){
			if(placedDesigns.length > 0){
				var filemap = {};
				for(var idx in placedDesigns){
					var design = placedDesigns[idx];
					var end = design.name.lastIndexOf('.');
					var name = design.name.substring(0, end);
					if(filemap[name] !== undefined) filemap[name] += 1;
					else filemap[name] = 1;
				}
				var mostPlaced;
				var placed = 0;
				for(var name in filemap){
					if(filemap[name] > placed){
						mostPlaced = name;
						placed = filemap[name];
					}
				}
				var uniqueDesigns = Object.keys(filemap).length;
				var gcode_name = mostPlaced;
				if(placed > 1) gcode_name += "." + placed + "x";
				if(uniqueDesigns > 1){
					gcode_name += "_"+(uniqueDesigns-1)+"more";
				}

				return gcode_name;
			} else {
				console.error("no designs placed.");
				return;
			}
		};

//		self.on_change_material_color = ko.computed(function(){
//			var new_material = self.selected_material();
//			var new_color = self.selected_color();
//			if(new_material === undefined || new_color === undefined){return;}
//
//			var material_changed = self.old_material != new_material;
//			var color_changed = self.old_color != new_color;
//			console.log(material_changed,color_changed);
//			console.log('Color',self.old_color,new_color);
//			console.log('Material',self.old_material,new_material);
//
//
//			if(color_changed){
//				// color settings alleine übernommen werden
//				if(self.color_settings[new_color] === undefined){
//					self.color_settings[new_color] = self.get_current_settings(new_material);
//				}else{
//					self.color_settings[self.old_color] = self.get_current_settings(self.old_material);
//					console.log('Apply color settings...');
//					self.apply_color_settings(self.color_settings[new_color]);
//				}
//				console.log('Color change from ',self.old_color,' to ',new_color);
//				self.old_color = new_color;
//				self.old_material = self.selected_material();
//			}else if(material_changed){
//				//material settings übernommen und color überschrieben
//				self.apply_material_settings(self.materials_settings[new_material]);
//				console.log('Material change from ',self.old_material,' to ',new_material);
//				self.old_material = new_material;
//				self.color_settings[new_color] = self.get_current_settings(new_material);
//				console.log('Color Settings Updated with new Material:',new_material);
//			}
//			console.log('OnChange: ', self.color_settings);
//		});


//		self.get_current_settings = function (material) {
//			return {material : material,
//					intensity : self.laserIntensity(),
//					speed : self.laserSpeed(),
//					cutColor : material !== 'none'
//			};
//		};

		self.get_current_multicolor_settings = function () {
			var data = [];
			$('.job_row_vector').each(function(i, pass){
				var intensity = $(pass).find('.param_intensity').val();
				var feedrate = $(pass).find('.param_feedrate').val();
				var piercetime = $(pass).find('.param_piercetime').val();
				var passes = $(pass).find('.param_passes').val();
				$(pass).find('.used_color').each(function(j, col){
					var hex = '#' + $(col).attr('id').substr(-6);
					data.push({
						job: i,
						color: hex,
						intensity: intensity,
						feedrate: feedrate,
						pierce_time: piercetime,
						passes: passes
					});
				});
			});
			return data;
		};

//		self.update_colorSettings = function(){
//			self.color_settings[self.selected_color()] = self.get_current_settings(self.selected_material());
//			for(var colHex in self.color_keys){
//				if(self.color_settings[self.color_keys[colHex]] === undefined){
//					self.color_settings[self.color_keys[colHex]] = self.get_current_settings('none')
//				}
//			}
//		};

//		self.apply_material_settings = function (settings){
//			//[laserInt,speed,engraveWhite,engraveBlack,speedWhite,speedBlack]
//			self.laserIntensity(settings[0]);
//			self.laserSpeed(settings[1]);
//			self.imgIntensityWhite(settings[2]);
//			self.imgIntensityBlack(settings[3]);
//			self.imgFeedrateWhite(settings[4]);
//			self.imgFeedrateBlack(settings[5]);
//		};
//
//		self.apply_color_settings = function (s){
//			//[laserInt,speed,engraveWhite,engraveBlack,speedWhite,speedBlack]
//			self.selected_material(s.material);
//			self.laserIntensity(s.intensity);
//			self.laserSpeed(s.speed);
//		};



//		self.settingsString = ko.computed(function(){
//			var intensity = self.laserIntensity();
//			var feedrate = self.laserSpeed();
//			var settingsString = "_i" + intensity + "s" + Math.round(feedrate);
//			return settingsString;
//		});

//		self.slicer.subscribe(function(newValue) {
//			self.profilesForSlicer(newValue);
//		});

		self.enableConvertButton = ko.computed(function() {
			if (self.slicing_in_progress() || self.workingArea.placedDesigns().length === 0 ) {
				return false;
			} else {
				return true;
			}
		});

		self.requestData = function() {
			$.ajax({
				url: API_BASEURL + "slicing",
				type: "GET",
				dataType: "json",
				success: self.fromResponse
			});
		};

		self.fromResponse = function(data) {
			self.data = data;
		};

		self.convert = function() {
			if(self.gcodeFilesToAppend.length === 1 && self.svg === undefined){
				self.files.startGcodeWithSafetyWarning(self.gcodeFilesToAppend[0]);
			} else {
				//self.update_colorSettings();
				self.slicing_in_progress(true);
				self.workingArea.getCompositionSVG(self.do_engrave(), self.engrave_outlines(), function(composition){
					self.svg = composition;
					var filename = self.gcodeFilename() + '.gco';
					var gcodeFilename = self._sanitize(filename);

					var multicolor_data = self.get_current_multicolor_settings();
					var colorStr = '<!--COLOR_PARAMS_START' +JSON.stringify(multicolor_data) + 'COLOR_PARAMS_END-->';
					var data = {
						command: "convert",
						"engrave": self.do_engrave(),
						"engrave_outlines" : self.engrave_outlines(),
						"intensity_black" : self.imgIntensityBlack(),
						"intensity_white" : self.imgIntensityWhite(),
						"speed_black" : self.imgFeedrateBlack(),
						"speed_white" : self.imgFeedrateWhite(),
						"contrast" : self.imgContrast(),
						"sharpening" : self.imgSharpening(),
						"dithering" : self.imgDithering(),
						"beam_diameter" : self.beamDiameter(),
						"pierce_time": self.get_engraving_piercetime(),
						"multicolor" : multicolor_data,
						
						slicer: "svgtogcode",
						gcode: gcodeFilename
					};
										
					if(self.svg !== undefined){
						// TODO place comment within initial <svg > tag.
						data.svg = colorStr +"\n"+ self.svg;
					} else {
						data.svg = colorStr +"\n"+ '<svg height="0" version="1.1" width="0" xmlns="http://www.w3.org/2000/svg"><defs/></svg>';
					}
					if(self.gcodeFilesToAppend !== undefined){
						data.gcodeFilesToAppend = self.gcodeFilesToAppend;
					}

					$.ajax({
						url: "plugin/mrbeam/convert",
						type: "POST",
						dataType: "json",
						contentType: "application/json; charset=UTF-8",
						data: JSON.stringify(data)
					});

				});
			}
		};
		
		self.get_engraving_piercetime = function(){
			return $('#engrave_job .param_piercetime').val();
		};
		
		self.do_engrave = function(){
			var assigned_images = $('#engrave_job .assigned_colors').children().length;
			return (assigned_images > 0 && self.show_image_parameters());
		};

		self._sanitize = function(name) {
			return name.replace(/[^a-zA-Z0-9\-_\.\(\) ]/g, "").replace(/ /g, "_");
		};

		self.onStartup = function() {
			self.requestData();
			self.state.conversion = self; // hack! injecting method to avoid circular dependency.
			self.files.conversion = self;
//			self._configureIntensitySlider();
//			self._configureFeedrateSlider();
			self._configureImgSliders();
		};

		self.onSlicingProgress = function(slicer, model_path, machinecode_path, progress){
			self.slicing_progress(progress);
		};
		self.onEventSlicingStarted = function(payload){
			self.slicing_in_progress(true);
		};
		self.onEventSlicingDone = function(payload){
			// payload
//			gcode: "ex_11more_i1000s300.gco"
//			gcode_location: "local"
//			stl: "local/ex_11more_i1000s300.svg"
//			time: 30.612739086151123
			self.gcodeFilename(undefined);
			self.svg = undefined;
			$("#dialog_vector_graphics_conversion").modal("hide");
			self.slicing_in_progress(false);
			//console.log("onSlicingDone" , payload);
		};
		self.onEventSlicingCancelled = function(payload){
			self.gcodeFilename(undefined);
			self.svg = undefined;
			self.slicing_in_progress(false);
			$("#dialog_vector_graphics_conversion").modal("hide");
			//console.log("onSlicingCancelled" , payload);
		};
		self.onEventSlicingFailed = function(payload){
			self.slicing_in_progress(false);
			//console.log("onSlicingFailed" , payload);
		};

		self._configureIntensitySlider = function() {
			self.intensitySlider = $("#svgtogcode_intensity_slider").slider({
				id: "svgtogcode_intensity_slider_impl",
				reversed: false,
				selection: "after",
				orientation: "horizontal",
				min: 1,
				max: 1000,
				step: 1,
				value: 500,
				enabled: true,
				formatter: function(value) { return "" + (value/10) +"%"; }
			}).on("slideStop", function(ev){
				self.laserIntensity(ev.value);
			});

			self.laserIntensity.subscribe(function(newVal){
				self.intensitySlider.slider('setValue', parseInt(newVal));
			});
		};

		self._configureFeedrateSlider = function() {
			self.feedrateSlider = $("#svgtogcode_feedrate_slider").slider({
				id: "svgtogcode_feedrate_slider_impl",
				reversed: false,
				selection: "after",
				orientation: "horizontal",
				min: 0,
				max: 100, // fixed values to avoid reinitializing after profile changes
				step: 1,
				value: 300,
				enabled: true,
				formatter: function(value) { return "" + Math.round(self._calcRealSpeed(value)) +"mm/min"; }
			});

			// use the class as a flag to avoid double binding of the slideStop event
			if($("#svgtogcode_feedrate_slider").attr('class') === 'uninitialized'){ // somehow hasClass(...) did not work ???
				self.feedrateSlider.on("slideStop", function(ev){
					$('#svgtogcode_feedrate').val(self._calcRealSpeed(ev.value));
					self.laserSpeed(self._calcRealSpeed(ev.value));
				});
				$("#svgtogcode_feedrate_slider").removeClass('uninitialized');
			}

			var speedSubscription = self.laserSpeed.subscribe(function(fromSettings){
				var realVal = parseInt(fromSettings);
				var val = 100*(realVal - self.minSpeed()) / (self.maxSpeed() - self.minSpeed());
				self.feedrateSlider.slider('setValue', val);
				//speedSubscription.dispose(); // only do it once
			});
		};

		self._calcRealSpeed = function(sliderVal){
			return Math.round(self.minSpeed() + sliderVal/100 * (self.maxSpeed() - self.minSpeed()));
		};

		self._configureImgSliders = function() {
			self.contrastSlider = $("#svgtogcode_contrast_slider").slider({
				step: .1,
				min: 1,
				max: self.contrastMax,
				value: 1,
				tooltip: 'hide'
			}).on("slide", function(ev){
				self.imgContrast(ev.value);
			});

			self.sharpeningSlider = $("#svgtogcode_sharpening_slider").slider({
				step: 1,
				min: 1,
				max: self.sharpeningMax,
				value: 1,
				class: 'img_slider',
				tooltip: 'hide'
			}).on("slide", function(ev){
				self.imgSharpening(ev.value);
			});

		};

		self.showExpertSettings.subscribe(function(){
			$('#dialog_vector_graphics_conversion').trigger('resize');
		});
		
		self._update_color_assignments = function(){
			var jobs = $('#additional_jobs .job_row_vector');
			for (var idx = 0; idx < jobs.length; idx++) {
				var j = jobs[idx];
				var colors = $(j).find('.used_color');
				if(colors.length === 0){
					$(j).remove();
				}
			}
		};

	}


    ADDITIONAL_VIEWMODELS.push([VectorConversionViewModel,
		["loginStateViewModel", "settingsViewModel", "printerStateViewModel", "workingAreaViewModel", "gcodeFilesViewModel"],
		document.getElementById("dialog_vector_graphics_conversion")]);

});


// Drag functions outside the viewmodel are way less complicated
function colorAllowDrop(ev) {
    ev.preventDefault();
	$('.color_drop_zone').addClass('hover');
}
		
function colorDrag(ev) {
	$("body").addClass("colorDragInProgress");
	ev.dataTransfer.setData("text", ev.target.id);
	ev.dataTransfer.effectAllowed = "move";
}

function colorDrop(ev) {
    ev.preventDefault();
	setTimeout(function(){$("body").removeClass("colorDragInProgress");}, 200);
	$('.color_drop_zone').removeClass('hover');
    var data = ev.dataTransfer.getData("text");
    ev.target.appendChild(document.getElementById(data));
	ko.dataFor(document.getElementById("dialog_vector_graphics_conversion"))._update_color_assignments();
}

function colorDropCreateJob(ev) {
    ev.preventDefault();
	setTimeout(function(){$("body").removeClass("colorDragInProgress");}, 200);
	$('.color_drop_zone').removeClass('hover');
	
	var newJob = $('#first_job').clone(true);
	newJob.attr('id','');
	newJob.find('.used_color').remove();
	newJob.appendTo($('#additional_jobs'));
	
    var data = ev.dataTransfer.getData("text");
    var color = document.getElementById(data);
	$(newJob).find('.assigned_colors').append(color);
	ko.dataFor(document.getElementById("dialog_vector_graphics_conversion"))._update_color_assignments();
}

		
function colorDragEnd(ev){
    ev.preventDefault();
	setTimeout(function(){$("body").removeClass("colorDragInProgress");}, 200);
	$('.color_drop_zone').removeClass('hover');
}


