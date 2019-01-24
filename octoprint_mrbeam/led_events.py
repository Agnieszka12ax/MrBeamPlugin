

from octoprint.events import Events, CommandTrigger, GenericEventListener
from octoprint_mrbeam.mrbeam_events import MrBeamEvents
from octoprint_mrbeam.mrb_logger import mrb_logger


class LedEventListener(CommandTrigger):

	LED_EVENTS = {}
	LED_EVENTS[Events.STARTUP] = "mrbeam_ledstrips_cli listening"
	# connect/disconnect by client
	LED_EVENTS[Events.CLIENT_OPENED] = "mrbeam_ledstrips_cli ClientOpened"
	LED_EVENTS[Events.CLIENT_CLOSED] = "mrbeam_ledstrips_cli ClientClosed"
	# ready to laser
	LED_EVENTS[MrBeamEvents.READY_TO_LASER_START] = "mrbeam_ledstrips_cli ReadyToPrint"
	LED_EVENTS[MrBeamEvents.READY_TO_LASER_CANCELED] = "mrbeam_ledstrips_cli ReadyToPrintCancel"
	# print job
	LED_EVENTS[Events.PRINT_STARTED] = "mrbeam_ledstrips_cli PrintStarted"
	LED_EVENTS[Events.PRINT_DONE] = "mrbeam_ledstrips_cli PrintDone"
	LED_EVENTS[Events.PRINT_CANCELLED] = "mrbeam_ledstrips_cli PrintCancelled"
	LED_EVENTS[Events.PRINT_RESUMED] = "mrbeam_ledstrips_cli PrintResumed"
	LED_EVENTS[Events.ERROR] = "mrbeam_ledstrips_cli Error"
	LED_EVENTS[MrBeamEvents.LASER_JOB_DONE] = "mrbeam_ledstrips_cli LaserJobDone"
	LED_EVENTS[MrBeamEvents.LASER_JOB_CANCELLED] = "mrbeam_ledstrips_cli LaserJobCancelled"
	LED_EVENTS[MrBeamEvents.LASER_JOB_FAILED] = "mrbeam_ledstrips_cli LaserJobFailed"
	# LaserPauseSafetyTimeout Events
	LED_EVENTS[MrBeamEvents.LASER_PAUSE_SAFTEY_TIMEOUT_START] = "mrbeam_ledstrips_cli PrintPausedTimeout"
	LED_EVENTS[MrBeamEvents.LASER_PAUSE_SAFTEY_TIMEOUT_END] = "mrbeam_ledstrips_cli PrintPaused"
	LED_EVENTS[MrBeamEvents.LASER_PAUSE_SAFTEY_TIMEOUT_BLOCK] = "mrbeam_ledstrips_cli PrintPausedTimeoutBlock"

	LED_EVENTS[MrBeamEvents.BUTTON_PRESS_REJECT] = "mrbeam_ledstrips_cli ButtonPressReject"


	# File management
	# LED_EVENTS[Events.UPLOAD] = "mrbeam_ledstrips_cli Upload"
	# Slicing
	LED_EVENTS[Events.SLICING_STARTED] = "mrbeam_ledstrips_cli SlicingStarted"
	LED_EVENTS[Events.SLICING_DONE] = "mrbeam_ledstrips_cli SlicingDone"
	LED_EVENTS[Events.SLICING_CANCELLED] = "mrbeam_ledstrips_cli SlicingCancelled"
	LED_EVENTS[Events.SLICING_FAILED] = "mrbeam_ledstrips_cli SlicingFailed"
	# Settings
	# LED_EVENTS[Events.SETTINGS_UPDATED] = "mrbeam_ledstrips_cli SettingsUpdated"
	# MrBeam Events
	LED_EVENTS[MrBeamEvents.SLICING_PROGRESS] = "mrbeam_ledstrips_cli SlicingProgress:{__progress}"
	LED_EVENTS[MrBeamEvents.PRINT_PROGRESS] = "mrbeam_ledstrips_cli progress:{__progress}"
	#Shutdown
	LED_EVENTS[MrBeamEvents.SHUTDOWN_PREPARE_START] = "mrbeam_ledstrips_cli ShutdownPrepare"
	LED_EVENTS[MrBeamEvents.SHUTDOWN_PREPARE_CANCEL] = "mrbeam_ledstrips_cli ShutdownPrepareCancel"
	LED_EVENTS[MrBeamEvents.SHUTDOWN_PREPARE_SUCCESS] = "mrbeam_ledstrips_cli Shutdown"
	LED_EVENTS[Events.SHUTDOWN] = "mrbeam_ledstrips_cli Shutdown"

	COMMAND_LISTENING_WIFI = "mrbeam_ledstrips_cli listening_wifi"
	COMMAND_LISTENING_AP = "mrbeam_ledstrips_cli listening_ap"


	def __init__(self, event_bus, printer):
		CommandTrigger.__init__(self, printer)
		self._event_bus = event_bus
		self._logger = mrb_logger("octoprint.plugins.mrbeam.led_events")

		self._subscriptions = {}

		self._initSubscriptions()


	def _initSubscriptions(self):
		for event in self.LED_EVENTS:
			if not event in self._subscriptions.keys():
				self._subscriptions[event] = []
			self._subscriptions[event].append((self.LED_EVENTS[event], "system", False))

		self.subscribe(self.LED_EVENTS.keys())


	def eventCallback(self, event, payload):
		# really, just copied this one from OctoPrint to add my debug log line.

		GenericEventListener.eventCallback(self, event, payload)

		if not event in self._subscriptions:
			return

		for command, commandType, debug in self._subscriptions[event]:

			if command in (self.LED_EVENTS[Events.STARTUP], self.LED_EVENTS[Events.CLIENT_CLOSED]):
				command = self._handleStartupCommand()

			try:
				if isinstance(command, (tuple, list, set)):
					processedCommand = []
					for c in command:
						processedCommand.append(self._processCommand(c, payload))
				else:
					processedCommand = self._processCommand(command, payload)

				self._logger.debug("LED_EVENT %s: '%s'", event, processedCommand)
				self.executeCommand(processedCommand, commandType, debug=debug)
			except KeyError as e:
				self._logger.warn("There was an error processing one or more placeholders in the following command: %s" % command)

	def _handleStartupCommand(self):
		status = None
		wifi_connected = None
		try:
			pluginInfo = _mrbeam_plugin_implementation._plugin_manager.get_plugin_info("netconnectd")
			if pluginInfo is not None:
				status = pluginInfo.implementation._get_status()
				wifi_connected = status["connections"]["wifi"]
		except Exception as e:
			self._logger.exception("Exception while reading wifi state from netconnectd:")

		if wifi_connected:
			return self.COMMAND_LISTENING_WIFI
		else:
			return self.COMMAND_LISTENING_AP
