import time
from octoprint.printer.standard import Printer, StateMonitor
from octoprint.events import eventManager, Events
from octoprint_mrbeam.mrbeam_events import MrBeamEvents
from octoprint_mrbeam.printing import comm_acc2 as comm
from octoprint_mrbeam.mrb_logger import mrb_logger
from octoprint_mrbeam.filemanager.analysis import beam_analysis_queue_factory
from octoprint_mrbeam.util import dict_merge


class Laser(Printer):
    HOMING_POSITION = [-1.0, -1.0, 0]

    def __init__(self, fileManager, analysisQueue, printerProfileManager):
        # MR_BEAM_OCTOPRINT_PRIVATE_API_ACCESS -- start --
        # TODO OP v1.4 : Remove the followingline - see octoprint_mrbeam.__plugin_load__
        # The necessary lines for this to keep working are already written as a hook.
        analysisQueue._queues.update(
            beam_analysis_queue_factory(callback=analysisQueue._analysis_finished)
        )
        # MR_BEAM_OCTOPRINT_PRIVATE_API_ACCESS -- end --
        Printer.__init__(self, fileManager, analysisQueue, printerProfileManager)
        self._logger = mrb_logger("octoprint.plugins.mrbeam.printing.printer")
        self._stateMonitor = LaserStateMonitor(
            interval=0.5,
            on_update=self._sendCurrentDataCallbacks,
            on_add_temperature=self._sendAddTemperatureCallbacks,
            on_add_log=self._sendAddLogCallbacks,
            on_add_message=self._sendAddMessageCallbacks,
            on_get_progress=self._updateProgressDataCallback,
        )
        self._stateMonitor.reset(
            state={"text": self.get_state_string(), "flags": self._getStateFlags()},
            job_data={
                "file": {"name": None, "size": None, "origin": None, "date": None},
                "estimatedPrintTime": None,
                "lastPrintTime": None,
                "filament": {"length": None, "volume": None},
            },
            progress={
                "completion": None,
                "filepos": None,
                "printTime": None,
                "printTimeLeft": None,
            },
            current_z=None,
        )

    # overwrite connect to use comm_acc2
    def connect(self, port=None, baudrate=None, profile=None):
        """Connects to the printer.

        If port and/or baudrate is provided, uses these settings,
        otherwise autodetection will be attempted.
        """
        self._init_terminal()

        if self._comm is not None:
            self._comm.close()

        eventManager().fire(Events.CONNECTING, payload=dict(profile=profile))
        self._printerProfileManager.select(profile)
        self._comm = comm.MachineCom(
            port,
            baudrate,
            callbackObject=self,
            printerProfileManager=self._printerProfileManager,
        )

    # overwrite operational state to accept commands in locked state
    def is_operational(self):
        return Printer.is_operational(self) or self.is_locked()

    # send color settings to commAcc to inject settings into Gcode
    def set_colors(self, currentFileName, value):
        if self._comm is None:
            return
        self._comm.setColors(currentFileName, value)

    # extend commands: home, position, increase_passes, decrease_passes
    def home(self, axes):
        printer_profile = self._printerProfileManager.get_current_or_default()
        params = dict(
            x=printer_profile["volume"]["width"]
            + printer_profile["volume"]["working_area_shift_x"],
            y=printer_profile["volume"]["depth"]
            + printer_profile["volume"]["working_area_shift_y"],
            z=0,
        )
        self._comm.rescue_from_home_pos()
        command = "G92X{x}Y{y}Z{z}".format(**params)
        self.commands(["$H", command, "G90", "G21"])

    def is_homed(self):
        return self._stateMonitor._machinePosition == self.HOMING_POSITION

    def cancel_print(self):
        """Cancel the current printjob and do homing."""
        super(Laser, self).cancel_print()
        time.sleep(0.5)
        self.home(axes="wtf")
        eventManager().fire(MrBeamEvents.PRINT_CANCELING_DONE)

    def fail_print(self, error_msg=None):
        """Cancel the current printjob (as it failed) and do homing."""
        if self._comm is None:
            return

        # If we want the job to show as failed instead of cancelled, we have to mimic self._printer.cancel_print()
        self._comm.cancelPrint(failed=True, error_msg=error_msg)

        time.sleep(0.5)
        self.home(axes="wtf")
        eventManager().fire(MrBeamEvents.PRINT_CANCELING_DONE)

    def position(self, x, y):
        printer_profile = self._printerProfileManager.get_current_or_default()
        movement_speed = min(
            printer_profile["axes"]["x"]["speed"], printer_profile["axes"]["y"]["speed"]
        )
        self.commands(["G90", "G0 X%.3f Y%.3f F%d" % (x, y, movement_speed)])

    def increase_passes(self):
        """increase the number of passes by one."""
        if self._comm is None:
            return
        self._comm.increasePasses()

    def set_passes(self, value):
        if self._comm is None:
            return
        self._comm.setPasses(value)

    def decrease_passes(self):
        """decrease the number of passes by one."""
        if self._comm is None:
            return
        self._comm.decreasePasses()

    def pause_print(self, force=False, trigger=None):
        """Pause the current printjob."""
        if self._comm is None:
            return

        if not force and self._comm.isPaused():
            return

        self._comm.setPause(True, send_cmd=True, trigger=trigger)

    def cooling_start(self):
        """Pasue the laser for cooling."""
        if self._comm is None:
            return

        if self._comm.isPaused():
            return

        self._comm.setPause(True, pause_for_cooling=True, trigger="Cooling")

    # extend flags
    def is_locked(self):
        return self._comm is not None and self._comm.isLocked()

    def is_flashing(self):
        return self._comm is not None and self._comm.isFlashing()

    def _getStateFlags(self):
        # Extra gymnastics in case state flags are a frozen dict
        flags = Printer._getStateFlags(self)
        _dict = flags.__class__
        flags = dict_merge(
            {
                "locked": self.is_locked(),
                "flashing": self.is_flashing(),
            },
            flags,
        )
        return _dict(flags)

    # position update callbacks
    def on_comm_pos_update(self, MPos, WPos):
        self._add_position_data(MPos, WPos)

    # progress update callbacks
    def on_comm_progress(self):
        self._updateProgressData(
            self._comm.getPrintProgress(),
            self._comm.getPrintFilepos(),
            self._comm.getPrintTime(),
            self._comm.getCleanedPrintTime(),
        )
        self._stateMonitor.trigger_progress_update()

    def _add_position_data(self, MPos, WPos):
        if MPos is not None:
            self._stateMonitor.setMachinePosition(MPos)
        if WPos is not None:
            self._stateMonitor.setWorkPosition(WPos)

    def _init_terminal(self):
        from collections import deque

        terminalMaxLines = _mrbeam_plugin_implementation._settings.get(
            ["dev", "terminalMaxLines"]
        )
        if terminalMaxLines is not None and terminalMaxLines > 0:
            self._log = deque(self._log, terminalMaxLines)

    # maybe one day we want to introduce special MrBeam commands....
    # def commands(self, commands):
    # 	"""
    # 	Sends one or more gcode commands to the printer.
    # 	"""
    # 	if self._comm is None:
    # 		return
    #
    # 	if not isinstance(commands, (list, tuple)):
    # 		commands = [commands]
    #
    # 	for command in commands:
    # 		self._logger.debug("Laser.commands() %s", command)
    # 		sendCommandToPrinter = True
    # 		if _mrbeam_plugin_implementation is not None:
    # 			sendCommandToPrinter = _mrbeam_plugin_implementation.execute_command(command)
    # 		if sendCommandToPrinter:
    # 			self._comm.sendCommand(command)


class LaserStateMonitor(StateMonitor):
    def __init__(self, *args, **kwargs):
        StateMonitor.__init__(self, *args, **kwargs)
        self._machinePosition = None
        self._workPosition = None

    def setWorkPosition(self, workPosition):
        self._workPosition = workPosition
        self._change_event.set()

    def setMachinePosition(self, machinePosition):
        self._machinePosition = machinePosition
        self._change_event.set()

    def get_current_data(self):
        data = StateMonitor.get_current_data(self)
        data.update(
            {
                "workPosition": self._workPosition,
                "machinePosition": self._machinePosition,
            }
        )
        mrb_state = _mrbeam_plugin_implementation.get_mrb_state()
        if mrb_state:
            data["mrb_state"] = mrb_state
        return data
