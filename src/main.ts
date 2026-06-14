"use strict";

import * as utils from "@iobroker/adapter-core";

import { GoodWeUdp } from "./lib/goodWeUdp.js";

class Goodwe extends utils.Adapter {
	private readonly inverter = new GoodWeUdp(this);
	private tmrTimeout: ioBroker.Timeout | undefined;
	private cycleCnt = 0;

	/**
	 * Creates a new Goodwe adapter instance and registers all ioBroker lifecycle event handlers.
	 *
	 * @param options Optional adapter configuration options passed to the base class
	 */
	public constructor(options: Partial<utils.AdapterOptions> = {}) {
		super({ ...options, name: "goodwe-pv" });
		this.on("ready", this.onReady.bind(this));
		this.on("stateChange", this.onStateChange.bind(this));
		this.on("unload", this.onUnload.bind(this));
	}

	/**
	 * Is called when databases are connected and adapter received configuration.
	 */
	private async onReady(): Promise<void> {
		this.createObjectsDeviceInfo();
		this.createObjectsRunningData();
		this.createObjectsExtComData();
		this.createObjectsBmsInfo();

		void this.setState("info.connection", false, true);

		this.inverter.Connect(this.config.ipAddr, 8899);
		this.myTimer();

		const pwResult = await this.checkPasswordAsync("admin", "iobroker");
		this.log.info(`check user admin pw iobroker: ${String(pwResult)}`);

		const groupResult = await this.checkGroupAsync("admin", "admin");
		this.log.info(`check group user admin group admin: ${String(groupResult)}`);
	}

	/**
	 * Is called when adapter shuts down - callback has to be called under any circumstances!
	 *
	 * @param callback Callback to call after cleanup is complete
	 */
	private onUnload(callback: () => void): void {
		try {
			this.clearTimeout(this.tmrTimeout);
			callback();
		} catch {
			callback();
		}
	}

	/**
	 * Is called if a subscribed state changes.
	 *
	 * @param id State ID of the changed object
	 * @param state New state value, or null if deleted
	 */
	private onStateChange(id: string, state: ioBroker.State | null | undefined): void {
		if (state) {
			this.log.info(`state ${id} changed: ${state.val} (ack = ${state.ack})`);
		} else {
			this.log.info(`state ${id} deleted`);
		}
	}

	private createObjectsDeviceInfo(): void {
		void this.setObjectNotExistsAsync("DeviceInfo", { type: "channel", common: { name: "DeviceInfo" }, native: {} });
		this.createObjectStateNumber("DeviceInfo", "ModbusProtocolVersion");
		this.createObjectStateNumber("DeviceInfo", "RatedPower");
		this.createObjectStateNumber("DeviceInfo", "AcOutputType");
		this.createObjectStateString("DeviceInfo", "SerialNumber");
		this.createObjectStateString("DeviceInfo", "DeviceType");
		this.createObjectStateNumber("DeviceInfo", "DSP1_SW_Version");
		this.createObjectStateNumber("DeviceInfo", "DSP2_SW_Version");
		this.createObjectStateNumber("DeviceInfo", "DSP_SVN_Version");
		this.createObjectStateNumber("DeviceInfo", "ARM_SW_Version");
		this.createObjectStateNumber("DeviceInfo", "ARM_SVN_Version");
		this.createObjectStateString("DeviceInfo", "DSP_Int_FW_Version");
		this.createObjectStateString("DeviceInfo", "ARM_Int_FW_Version");
	}

	private createObjectsRunningData(): void {
		void this.setObjectNotExistsAsync("RunningData", { type: "channel", common: { name: "RunningData" }, native: {} });
		this.createObjectsDcParameters("RunningData", "PV1");
		this.createObjectsDcParameters("RunningData", "PV2");
		this.createObjectsDcParameters("RunningData", "PV3");
		this.createObjectsDcParameters("RunningData", "PV4");
		this.createObjectsAcPhase("RunningData", "GridL1");
		this.createObjectsAcPhase("RunningData", "GridL2");
		this.createObjectsAcPhase("RunningData", "GridL3");
		this.createObjectStateNumber("RunningData", "GridMode");
		this.createObjectStateNumber("RunningData", "InverterTotalPower");
		this.createObjectStateNumber("RunningData", "AcActivePower");
		this.createObjectStateNumber("RunningData", "AcReactivePower");
		this.createObjectStateNumber("RunningData", "AcApparentPower");
		this.createObjectsPhaseBackUp("RunningData", "BackUpL1");
		this.createObjectsPhaseBackUp("RunningData", "BackUpL2");
		this.createObjectsPhaseBackUp("RunningData", "BackUpL3");
		this.createObjectStateNumber("RunningData", "PowerL1");
		this.createObjectStateNumber("RunningData", "PowerL2");
		this.createObjectStateNumber("RunningData", "PowerL3");
		this.createObjectStateNumber("RunningData", "TotalPowerBackUp");
		this.createObjectStateNumber("RunningData", "TotalPower");
		this.createObjectStateNumber("RunningData", "UpsLoadPercent");
		this.createObjectStateNumber("RunningData", "AirTemperature");
		this.createObjectStateNumber("RunningData", "ModulTemperature");
		this.createObjectStateNumber("RunningData", "RadiatorTemperature");
		this.createObjectStateNumber("RunningData", "FunctionBitValue");
		this.createObjectStateNumber("RunningData", "BusVoltage");
		this.createObjectStateNumber("RunningData", "NbusVoltage");
		this.createObjectsDcParameters("RunningData", "Battery1");
		this.createObjectStateNumber("RunningData", "WarningCode");
		this.createObjectStateNumber("RunningData", "SaftyCountry");
		this.createObjectStateNumber("RunningData", "WorkMode");
		this.createObjectStateNumber("RunningData", "OperationMode");
		this.createObjectStateNumber("RunningData", "ErrorMessage");
		this.createObjectStateNumber("RunningData", "PvEnergyTotal");
		this.createObjectStateNumber("RunningData", "PvEnergyDay");
		this.createObjectStateNumber("RunningData", "EnergyTotal");
		this.createObjectStateNumber("RunningData", "HoursTotal");
		this.createObjectStateNumber("RunningData", "EnergyDaySell");
		this.createObjectStateNumber("RunningData", "EnergyTotalBuy");
		this.createObjectStateNumber("RunningData", "EnergyDayBuy");
		this.createObjectStateNumber("RunningData", "EnergyTotalLoad");
		this.createObjectStateNumber("RunningData", "EnergyDayLoad");
		this.createObjectStateNumber("RunningData", "EnergyBatteryCharge");
		this.createObjectStateNumber("RunningData", "EnergyDayCharge");
		this.createObjectStateNumber("RunningData", "EnergyBatteryDischarge");
		this.createObjectStateNumber("RunningData", "EnergyDayDischarge");
		this.createObjectStateNumber("RunningData", "BatteryStrings");
		this.createObjectStateNumber("RunningData", "CpldWarningCode");
		this.createObjectStateNumber("RunningData", "WChargeCtrFlag");
		this.createObjectStateNumber("RunningData", "DerateFrozenPower");
		this.createObjectStateNumber("RunningData", "DiagStatusH");
		this.createObjectStateNumber("RunningData", "DiagStatusL");
		this.createObjectStateNumber("RunningData", "TotalPowerPv");
	}

	private createObjectsExtComData(): void {
		void this.setObjectNotExistsAsync("ExtComData", { type: "channel", common: { name: "ExtComData" }, native: {} });
		this.createObjectStateNumber("ExtComData", "Commode");
		this.createObjectStateNumber("ExtComData", "Rssi");
		this.createObjectStateNumber("ExtComData", "ManufacturerCode");
		this.createObjectStateNumber("ExtComData", "MeterConnectStatus");
		this.createObjectStateNumber("ExtComData", "MeterCommunicateStatus");
		this.createObjectMeterPhase("ExtComData", "L1");
		this.createObjectMeterPhase("ExtComData", "L2");
		this.createObjectMeterPhase("ExtComData", "L3");
		this.createObjectStateNumber("ExtComData", "TotalActivePower");
		this.createObjectStateNumber("ExtComData", "TotalReactivePower");
		this.createObjectStateNumber("ExtComData", "PowerFactor");
		this.createObjectStateNumber("ExtComData", "Frequency");
		this.createObjectStateNumber("ExtComData", "EnergyTotalSell");
		this.createObjectStateNumber("ExtComData", "EnergyTotalBuy");
	}

	private createObjectsBmsInfo(): void {
		void this.setObjectNotExistsAsync("BMSInfo", { type: "channel", common: { name: "BMSInfo" }, native: {} });
		this.createObjectStateNumber("BMSInfo", "Status");
		this.createObjectStateNumber("BMSInfo", "PackTemperature");
		this.createObjectStateNumber("BMSInfo", "CurrentMaxCharge");
		this.createObjectStateNumber("BMSInfo", "CurrentMaxDischarge");
		this.createObjectStateNumber("BMSInfo", "ErrorCode");
		this.createObjectStateNumber("BMSInfo", "SOC");
		this.createObjectStateNumber("BMSInfo", "SOH");
		this.createObjectStateNumber("BMSInfo", "BatteryStrings");
	}

	/**
	 * Creates a numeric state object if it does not already exist.
	 *
	 * @param path Channel path
	 * @param name State name
	 */
	private createObjectStateNumber(path: string, name: string): void {
		void this.setObjectNotExistsAsync(`${path}.${name}`, {
			type: "state",
			common: { name, type: "number", role: "value", read: true, write: false },
			native: {},
		});
	}

	/**
	 * Creates a string state object if it does not already exist.
	 *
	 * @param path Channel path
	 * @param name State name
	 */
	private createObjectStateString(path: string, name: string): void {
		void this.setObjectNotExistsAsync(`${path}.${name}`, {
			type: "state",
			common: { name, type: "string", role: "text", read: true, write: false },
			native: {},
		});
	}

	/**
	 * Creates a DC parameters channel (Voltage, Current, Power, Mode) if it does not already exist.
	 *
	 * @param path Parent channel path
	 * @param name Channel name
	 */
	private createObjectsDcParameters(path: string, name: string): void {
		void this.setObjectNotExistsAsync(`${path}.${name}`, { type: "channel", common: { name }, native: {} });
		for (const field of ["Voltage", "Current", "Power", "Mode"]) {
			void this.setObjectNotExistsAsync(`${path}.${name}.${field}`, {
				type: "state",
				common: { name: field, type: "number", role: "value", read: true, write: false },
				native: {},
			});
		}
	}

	/**
	 * Creates an AC phase channel (Voltage, Current, Frequency, Power) if it does not already exist.
	 *
	 * @param path Parent channel path
	 * @param name Channel name
	 */
	private createObjectsAcPhase(path: string, name: string): void {
		void this.setObjectNotExistsAsync(`${path}.${name}`, { type: "channel", common: { name }, native: {} });
		for (const field of ["Voltage", "Current", "Frequency", "Power"]) {
			void this.setObjectNotExistsAsync(`${path}.${name}.${field}`, {
				type: "state",
				common: { name: field, type: "number", role: "value", read: true, write: false },
				native: {},
			});
		}
	}

	/**
	 * Creates a backup phase channel (Voltage, Current, Frequency, Power, Mode) if it does not already exist.
	 *
	 * @param path Parent channel path
	 * @param name Channel name
	 */
	private createObjectsPhaseBackUp(path: string, name: string): void {
		void this.setObjectNotExistsAsync(`${path}.${name}`, { type: "channel", common: { name }, native: {} });
		for (const field of ["Voltage", "Current", "Frequency", "Power", "Mode"]) {
			void this.setObjectNotExistsAsync(`${path}.${name}.${field}`, {
				type: "state",
				common: { name: field, type: "number", role: "value", read: true, write: false },
				native: {},
			});
		}
	}

	/**
	 * Creates a meter phase channel (ActivePower, PowerFactor) if it does not already exist.
	 *
	 * @param path Parent channel path
	 * @param name Channel name
	 */
	private createObjectMeterPhase(path: string, name: string): void {
		void this.setObjectNotExistsAsync(`${path}.${name}`, { type: "channel", common: { name }, native: {} });
		for (const field of ["ActivePower", "PowerFactor"]) {
			void this.setObjectNotExistsAsync(`${path}.${name}.${field}`, {
				type: "state",
				common: { name: field, type: "number", role: "value", read: true, write: false },
				native: {},
			});
		}
	}

	private updateDeviceInfo(): void {
		this.inverter.ReadDeviceInfo();
		void this.setStateAsync("DeviceInfo.ModbusProtocolVersion", this.inverter.DeviceInfo.ModbusProtocolVersion, true);
		void this.setStateAsync("DeviceInfo.RatedPower", this.inverter.DeviceInfo.RatedPower, true);
		void this.setStateAsync("DeviceInfo.AcOutputType", this.inverter.DeviceInfo.AcOutputType, true);
		void this.setStateAsync("DeviceInfo.SerialNumber", this.inverter.DeviceInfo.SerialNumber, true);
		void this.setStateAsync("DeviceInfo.DeviceType", this.inverter.DeviceInfo.DeviceType, true);
		void this.setStateAsync("DeviceInfo.DSP1_SW_Version", this.inverter.DeviceInfo.DSP1_SoftwareVersion, true);
		void this.setStateAsync("DeviceInfo.DSP2_SW_Version", this.inverter.DeviceInfo.DSP2_SoftwareVersion, true);
		void this.setStateAsync("DeviceInfo.DSP_SVN_Version", this.inverter.DeviceInfo.DSP_SVN_Version, true);
		void this.setStateAsync("DeviceInfo.ARM_SW_Version", this.inverter.DeviceInfo.ARM_SoftwareVersion, true);
		void this.setStateAsync("DeviceInfo.ARM_SVN_Version", this.inverter.DeviceInfo.ARM_SVN_Version, true);
		void this.setStateAsync("DeviceInfo.DSP_Int_FW_Version", this.inverter.DeviceInfo.DSP_IntFirmwareVersion, true);
		void this.setStateAsync("DeviceInfo.ARM_Int_FW_Version", this.inverter.DeviceInfo.ARM_IntFirmwareVersion, true);
		void this.setStateAsync("info.connection", this.inverter.Status, true);
	}

	private updateRunningData(): void {
		this.inverter.ReadRunningData();
		const rd = this.inverter.RunningData;
		void this.setStateAsync("RunningData.PV1.Voltage", rd.Pv1.Voltage, true);
		void this.setStateAsync("RunningData.PV1.Current", rd.Pv1.Current, true);
		void this.setStateAsync("RunningData.PV1.Power", rd.Pv1.Power, true);
		void this.setStateAsync("RunningData.PV1.Mode", rd.Pv1.Mode, true);
		void this.setStateAsync("RunningData.PV2.Voltage", rd.Pv2.Voltage, true);
		void this.setStateAsync("RunningData.PV2.Current", rd.Pv2.Current, true);
		void this.setStateAsync("RunningData.PV2.Power", rd.Pv2.Power, true);
		void this.setStateAsync("RunningData.PV2.Mode", rd.Pv2.Mode, true);
		void this.setStateAsync("RunningData.PV3.Voltage", rd.Pv3.Voltage, true);
		void this.setStateAsync("RunningData.PV3.Current", rd.Pv3.Current, true);
		void this.setStateAsync("RunningData.PV3.Power", rd.Pv3.Power, true);
		void this.setStateAsync("RunningData.PV3.Mode", rd.Pv3.Mode, true);
		void this.setStateAsync("RunningData.PV4.Voltage", rd.Pv4.Voltage, true);
		void this.setStateAsync("RunningData.PV4.Current", rd.Pv4.Current, true);
		void this.setStateAsync("RunningData.PV4.Power", rd.Pv4.Power, true);
		void this.setStateAsync("RunningData.PV4.Mode", rd.Pv4.Mode, true);
		void this.setStateAsync("RunningData.GridL1.Voltage", rd.GridL1.Voltage, true);
		void this.setStateAsync("RunningData.GridL1.Current", rd.GridL1.Current, true);
		void this.setStateAsync("RunningData.GridL1.Frequency", rd.GridL1.Frequency, true);
		void this.setStateAsync("RunningData.GridL1.Power", rd.GridL1.Power, true);
		void this.setStateAsync("RunningData.GridL2.Voltage", rd.GridL2.Voltage, true);
		void this.setStateAsync("RunningData.GridL2.Current", rd.GridL2.Current, true);
		void this.setStateAsync("RunningData.GridL2.Frequency", rd.GridL2.Frequency, true);
		void this.setStateAsync("RunningData.GridL2.Power", rd.GridL2.Power, true);
		void this.setStateAsync("RunningData.GridL3.Voltage", rd.GridL3.Voltage, true);
		void this.setStateAsync("RunningData.GridL3.Current", rd.GridL3.Current, true);
		void this.setStateAsync("RunningData.GridL3.Frequency", rd.GridL3.Frequency, true);
		void this.setStateAsync("RunningData.GridL3.Power", rd.GridL3.Power, true);
		void this.setStateAsync("RunningData.GridMode", rd.GridMode, true);
		void this.setStateAsync("RunningData.InverterTotalPower", rd.InverterTotalPower, true);
		void this.setStateAsync("RunningData.AcActivePower", rd.AcActivePower, true);
		void this.setStateAsync("RunningData.AcReactivePower", rd.AcReactivePower, true);
		void this.setStateAsync("RunningData.AcApparentPower", rd.AcApparentPower, true);
		void this.setStateAsync("RunningData.BackUpL1.Voltage", rd.BackUpL1.Voltage, true);
		void this.setStateAsync("RunningData.BackUpL1.Current", rd.BackUpL1.Current, true);
		void this.setStateAsync("RunningData.BackUpL1.Frequency", rd.BackUpL1.Frequency, true);
		void this.setStateAsync("RunningData.BackUpL1.Power", rd.BackUpL1.Power, true);
		void this.setStateAsync("RunningData.BackUpL1.Mode", rd.BackUpL1.Mode, true);
		void this.setStateAsync("RunningData.BackUpL2.Voltage", rd.BackUpL2.Voltage, true);
		void this.setStateAsync("RunningData.BackUpL2.Current", rd.BackUpL2.Current, true);
		void this.setStateAsync("RunningData.BackUpL2.Frequency", rd.BackUpL2.Frequency, true);
		void this.setStateAsync("RunningData.BackUpL2.Power", rd.BackUpL2.Power, true);
		void this.setStateAsync("RunningData.BackUpL2.Mode", rd.BackUpL2.Mode, true);
		void this.setStateAsync("RunningData.BackUpL3.Voltage", rd.BackUpL3.Voltage, true);
		void this.setStateAsync("RunningData.BackUpL3.Current", rd.BackUpL3.Current, true);
		void this.setStateAsync("RunningData.BackUpL3.Frequency", rd.BackUpL3.Frequency, true);
		void this.setStateAsync("RunningData.BackUpL3.Power", rd.BackUpL3.Power, true);
		void this.setStateAsync("RunningData.BackUpL3.Mode", rd.BackUpL3.Mode, true);
		void this.setStateAsync("RunningData.PowerL1", rd.PowerL1, true);
		void this.setStateAsync("RunningData.PowerL2", rd.PowerL2, true);
		void this.setStateAsync("RunningData.PowerL3", rd.PowerL3, true);
		void this.setStateAsync("RunningData.TotalPowerBackUp", rd.TotalPowerBackUp, true);
		void this.setStateAsync("RunningData.TotalPower", rd.TotalPower, true);
		void this.setStateAsync("RunningData.UpsLoadPercent", rd.UpsLoadPercent, true);
		void this.setStateAsync("RunningData.AirTemperature", rd.AirTemperature, true);
		void this.setStateAsync("RunningData.ModulTemperature", rd.ModulTemperature, true);
		void this.setStateAsync("RunningData.RadiatorTemperature", rd.RadiatorTemperature, true);
		void this.setStateAsync("RunningData.FunctionBitValue", rd.FunctionBitValue, true);
		void this.setStateAsync("RunningData.BusVoltage", rd.BusVoltage, true);
		void this.setStateAsync("RunningData.NbusVoltage", rd.NbusVoltage, true);
		void this.setStateAsync("RunningData.Battery1.Voltage", rd.Battery1.Voltage, true);
		void this.setStateAsync("RunningData.Battery1.Current", rd.Battery1.Current, true);
		void this.setStateAsync("RunningData.Battery1.Power", rd.Battery1.Power, true);
		void this.setStateAsync("RunningData.Battery1.Mode", rd.Battery1.Mode, true);
		void this.setStateAsync("RunningData.WarningCode", rd.WarningCode, true);
		void this.setStateAsync("RunningData.SaftyCountry", rd.SaftyCountry, true);
		void this.setStateAsync("RunningData.WorkMode", rd.WorkMode, true);
		void this.setStateAsync("RunningData.OperationMode", rd.OperationMode, true);
		void this.setStateAsync("RunningData.ErrorMessage", rd.ErrorMessage, true);
		void this.setStateAsync("RunningData.PvEnergyTotal", rd.PvEnergyTotal, true);
		void this.setStateAsync("RunningData.PvEnergyDay", rd.PvEnergyDay, true);
		void this.setStateAsync("RunningData.EnergyTotal", rd.EnergyTotal, true);
		void this.setStateAsync("RunningData.HoursTotal", rd.HoursTotal, true);
		void this.setStateAsync("RunningData.EnergyDaySell", rd.EnergyDaySell, true);
		void this.setStateAsync("RunningData.EnergyTotalBuy", rd.EnergyTotalBuy, true);
		void this.setStateAsync("RunningData.EnergyDayBuy", rd.EnergyDayBuy, true);
		void this.setStateAsync("RunningData.EnergyTotalLoad", rd.EnergyTotalLoad, true);
		void this.setStateAsync("RunningData.EnergyDayLoad", rd.EnergyDayLoad, true);
		void this.setStateAsync("RunningData.EnergyBatteryCharge", rd.EnergyBatteryCharge, true);
		void this.setStateAsync("RunningData.EnergyDayCharge", rd.EnergyDayCharge, true);
		void this.setStateAsync("RunningData.EnergyBatteryDischarge", rd.EnergyBatteryDischarge, true);
		void this.setStateAsync("RunningData.EnergyDayDischarge", rd.EnergyDayDischarge, true);
		void this.setStateAsync("RunningData.BatteryStrings", rd.BatteryStrings, true);
		void this.setStateAsync("RunningData.CpldWarningCode", rd.CpldWarningCode, true);
		void this.setStateAsync("RunningData.WChargeCtrFlag", rd.WChargeCtrFlag, true);
		void this.setStateAsync("RunningData.DerateFrozenPower", rd.DerateFrozenPower, true);
		void this.setStateAsync("RunningData.DiagStatusH", rd.DiagStatusH, true);
		void this.setStateAsync("RunningData.DiagStatusL", rd.DiagStatusL, true);
		void this.setStateAsync("RunningData.TotalPowerPv", rd.TotalPowerPv, true);
	}

	private updateExtComData(): void {
		this.inverter.ReadExtComData();
		const ec = this.inverter.ExtComData;
		void this.setStateAsync("ExtComData.Commode", ec.Commode, true);
		void this.setStateAsync("ExtComData.Rssi", ec.Rssi, true);
		void this.setStateAsync("ExtComData.ManufacturerCode", ec.ManufacturerCode, true);
		void this.setStateAsync("ExtComData.MeterConnectStatus", ec.MeterConnectStatus, true);
		void this.setStateAsync("ExtComData.MeterCommunicateStatus", ec.MeterCommunicateStatus, true);
		void this.setStateAsync("ExtComData.L1.ActivePower", ec.L1.ActivePower, true);
		void this.setStateAsync("ExtComData.L1.PowerFactor", ec.L1.PowerFactor, true);
		void this.setStateAsync("ExtComData.L2.ActivePower", ec.L2.ActivePower, true);
		void this.setStateAsync("ExtComData.L2.PowerFactor", ec.L2.PowerFactor, true);
		void this.setStateAsync("ExtComData.L3.ActivePower", ec.L3.ActivePower, true);
		void this.setStateAsync("ExtComData.L3.PowerFactor", ec.L3.PowerFactor, true);
		void this.setStateAsync("ExtComData.TotalActivePower", ec.TotalActivePower, true);
		void this.setStateAsync("ExtComData.TotalReactivePower", ec.TotalReactivePower, true);
		void this.setStateAsync("ExtComData.PowerFactor", ec.PowerFactor, true);
		void this.setStateAsync("ExtComData.Frequency", ec.Frequency, true);
		void this.setStateAsync("ExtComData.EnergyTotalSell", ec.EnergyTotalSell, true);
		void this.setStateAsync("ExtComData.EnergyTotalBuy", ec.EnergyTotalBuy, true);
	}

	private updateBmsInfo(): void {
		this.inverter.ReadBmsInfo();
		const bms = this.inverter.BmsInfo;
		void this.setStateAsync("BMSInfo.Status", bms.Status, true);
		void this.setStateAsync("BMSInfo.PackTemperature", bms.PackTemperature, true);
		void this.setStateAsync("BMSInfo.CurrentMaxCharge", bms.CurrentMaxCharge, true);
		void this.setStateAsync("BMSInfo.CurrentMaxDischarge", bms.CurrentMaxDischarge, true);
		void this.setStateAsync("BMSInfo.ErrorCode", bms.ErrorCode, true);
		void this.setStateAsync("BMSInfo.SOC", bms.SOC, true);
		void this.setStateAsync("BMSInfo.SOH", bms.SOH, true);
		void this.setStateAsync("BMSInfo.BatteryStrings", bms.BatteryStrings, true);
	}

	private myTimer(): void {
		if (!this.inverter.Status) {
			this.cycleCnt = 0;
			this.inverter.ReadIdInfo();
		} else {
			switch (this.cycleCnt) {
				case 1:
					this.updateDeviceInfo();
					break;
				case 3:
					this.updateRunningData();
					break;
				case 5:
					this.updateExtComData();
					break;
				case 7:
					this.updateBmsInfo();
					break;
			}

			if (this.cycleCnt >= this.config.pollCycle) {
				this.cycleCnt = 0;
			}
			this.cycleCnt++;
		}

		this.tmrTimeout = this.setTimeout(() => this.myTimer(), 1000);
	}
}

if (require.main !== module) {
	module.exports = (options: Partial<utils.AdapterOptions>) => new Goodwe(options);
} else {
	new Goodwe();
}

export = Goodwe;
