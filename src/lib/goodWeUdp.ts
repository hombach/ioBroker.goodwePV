import * as utils from "@iobroker/adapter-core";
import dgram from "node:dgram";

import {
	GoodWeDeviceInfo,
	GoodWeExternalComData,
	GoodWeIdInfo,
	GoodWePacket,
	GoodWeRegister,
	GoodWeRunningData,
	GoodweBmsInfo,
} from "./goodWeTypes.js";

/** UDP communication handler for GoodWe inverters (ET/EH/BH/BT series). */
export class GoodWeUdp {
	static readonly ConStatus = { Offline: false, Online: true };

	private readonly adapter: utils.AdapterInstance;
	private status = GoodWeUdp.ConStatus.Offline;
	private ipAddr = "";
	private port = 0;
	private readonly client = dgram.createSocket("udp4");
	private readonly idInfo = new GoodWeIdInfo();
	private readonly deviceInfo = new GoodWeDeviceInfo();
	private readonly runningData = new GoodWeRunningData();
	private readonly extComData = new GoodWeExternalComData();
	private readonly bmsInfo = new GoodweBmsInfo();

	/**
	 * Initializes the UDP socket with unlimited listener count.
	 *
	 * @param adapter ioBroker adapter instance for logging
	 */
	constructor(adapter: utils.AdapterInstance) {
		this.adapter = adapter;
		this.client.setMaxListeners(0);
	}

	/** Closes the UDP socket and releases resources. */
	destructor(): void {
		this.client.close();
	}

	/**
	 * Connects to the inverter and initiates ID info query.
	 *
	 * @param ipAddr IP address of the inverter
	 * @param port UDP port number (typically 8899)
	 */
	Connect(ipAddr: string, port: number): void {
		this.ipAddr = ipAddr;
		this.port = port;
		this.ReadIdInfo();
	}

	/** Queries the inverter identification information via UDP packet protocol. */
	ReadIdInfo(): void {
		const sendbuf = new Uint8Array(9);
		let crc = 0;

		sendbuf[0] = GoodWePacket.Header.High;
		sendbuf[1] = GoodWePacket.Header.Low;
		sendbuf[2] = GoodWePacket.Addr.AP;
		sendbuf[3] = GoodWePacket.Addr.Inverter;
		sendbuf[4] = GoodWePacket.CtrCode.Read;
		sendbuf[5] = GoodWePacket.FcCodeRead.QueryIdInfo;
		sendbuf[6] = 0;

		for (let i = 0; i <= 6; i++) {
			crc = crc + sendbuf[i];
		}

		sendbuf[7] = crc >> 8;
		sendbuf[8] = crc & 0x00ff;

		try {
			this.client.on("message", rcvbuf => {
				if (this.checkRecPacket(rcvbuf, sendbuf[4], sendbuf[5])) {
					this.idInfo.FirmwareVersion = this.getStringFromByteArray(rcvbuf, 7, 5);
					this.idInfo.ModelName = this.getStringFromByteArray(rcvbuf, 12, 10);
					this.idInfo.Na = rcvbuf.subarray(22, 37);
					this.idInfo.SerialNumber = this.getStringFromByteArray(rcvbuf, 38, 16);
					this.idInfo.NomVpv = this.getUintFromByteArray(rcvbuf, 54, 4) / 10;
					this.idInfo.InternalVersion = this.getStringFromByteArray(rcvbuf, 58, 12);
					this.idInfo.SafetyCountryCode = rcvbuf[70];
					this.status = GoodWeUdp.ConStatus.Online;
				} else {
					this.status = GoodWeUdp.ConStatus.Offline;
				}
			});

			this.client.send(sendbuf, 0, sendbuf.length, this.port, this.ipAddr, err => {
				if (err) throw err;
			});
		} catch (error) {
			this.adapter.log.error(`ReadIdInfo: ${error}`);
		}
	}

	/** Queries the inverter device information via Modbus register protocol. */
	ReadDeviceInfo(): void {
		const sendbuf = new Uint8Array(8);

		sendbuf[0] = GoodWeRegister.Addr.Inverter;
		sendbuf[1] = GoodWeRegister.FcDode.Read;
		sendbuf[2] = 0x88;
		sendbuf[3] = 0xb8;
		sendbuf[4] = 0x00;
		sendbuf[5] = 0x21;

		const crc = this.calculateCrc16(sendbuf, 0, 6);
		sendbuf[6] = crc >> 8;
		sendbuf[7] = crc & 0x00ff;

		try {
			this.client.on("message", rcvbuf => {
				if (this.checkRecRegisterData(rcvbuf, sendbuf[1], sendbuf[5])) {
					this.deviceInfo.ModbusProtocolVersion = this.getUintFromByteArray(rcvbuf, 5, 2);
					this.deviceInfo.RatedPower = this.getUintFromByteArray(rcvbuf, 7, 2);
					this.deviceInfo.AcOutputType = this.getUintFromByteArray(rcvbuf, 9, 2);
					this.deviceInfo.SerialNumber = this.getStringFromByteArray(rcvbuf, 11, 16);
					this.deviceInfo.DeviceType = this.getStringFromByteArray(rcvbuf, 27, 10);
					this.deviceInfo.DSP1_SoftwareVersion = this.getUintFromByteArray(rcvbuf, 37, 2);
					this.deviceInfo.DSP2_SoftwareVersion = this.getUintFromByteArray(rcvbuf, 39, 2);
					this.deviceInfo.DSP_SVN_Version = this.getUintFromByteArray(rcvbuf, 41, 2);
					this.deviceInfo.ARM_SoftwareVersion = this.getUintFromByteArray(rcvbuf, 43, 2);
					this.deviceInfo.ARM_SVN_Version = this.getUintFromByteArray(rcvbuf, 45, 2);
					this.deviceInfo.DSP_IntFirmwareVersion = this.getStringFromByteArray(rcvbuf, 47, 12);
					this.deviceInfo.ARM_IntFirmwareVersion = this.getStringFromByteArray(rcvbuf, 59, 12);
					this.status = GoodWeUdp.ConStatus.Online;
				} else {
					this.status = GoodWeUdp.ConStatus.Offline;
				}
			});

			this.client.send(sendbuf, 0, sendbuf.length, this.port, this.ipAddr, err => {
				if (err) throw err;
			});
		} catch (error) {
			this.adapter.log.error(`ReadDeviceInfo: ${error}`);
		}
	}

	/** Queries the current running data (PV, grid, battery, energy counters) from the inverter. */
	ReadRunningData(): void {
		const sendbuf = new Uint8Array(8);

		sendbuf[0] = GoodWeRegister.Addr.Inverter;
		sendbuf[1] = GoodWeRegister.FcDode.Read;
		sendbuf[2] = 0x89;
		sendbuf[3] = 0x1c;
		sendbuf[4] = 0x00;
		sendbuf[5] = 0x7d;

		const crc = this.calculateCrc16(sendbuf, 0, 6);
		sendbuf[6] = crc >> 8;
		sendbuf[7] = crc & 0x00ff;

		try {
			this.client.on("message", rcvbuf => {
				if (this.checkRecRegisterData(rcvbuf, sendbuf[1], sendbuf[5])) {
					this.runningData.Pv1.Voltage = this.getUintFromByteArray(rcvbuf, 11, 2) / 10;
					this.runningData.Pv1.Current = this.getUintFromByteArray(rcvbuf, 13, 2) / 10;
					this.runningData.Pv1.Power = this.getUintFromByteArray(rcvbuf, 15, 4);
					this.runningData.Pv2.Voltage = this.getUintFromByteArray(rcvbuf, 19, 2) / 10;
					this.runningData.Pv2.Current = this.getUintFromByteArray(rcvbuf, 21, 2) / 10;
					this.runningData.Pv2.Power = this.getUintFromByteArray(rcvbuf, 23, 4);
					this.runningData.Pv3.Voltage = this.getUintFromByteArray(rcvbuf, 27, 2) / 10;
					this.runningData.Pv3.Current = this.getUintFromByteArray(rcvbuf, 29, 2) / 10;
					this.runningData.Pv3.Power = this.getUintFromByteArray(rcvbuf, 31, 4);
					this.runningData.Pv4.Voltage = this.getUintFromByteArray(rcvbuf, 35, 2) / 10;
					this.runningData.Pv4.Current = this.getUintFromByteArray(rcvbuf, 37, 2) / 10;
					this.runningData.Pv4.Power = this.getUintFromByteArray(rcvbuf, 39, 4);
					this.runningData.Pv4.Mode = rcvbuf[43];
					this.runningData.Pv3.Mode = rcvbuf[44];
					this.runningData.Pv2.Mode = rcvbuf[45];
					this.runningData.Pv1.Mode = rcvbuf[46];
					this.runningData.GridL1.Voltage = this.getUintFromByteArray(rcvbuf, 47, 2) / 10;
					this.runningData.GridL1.Current = this.getUintFromByteArray(rcvbuf, 49, 2) / 10;
					this.runningData.GridL1.Frequency = this.getUintFromByteArray(rcvbuf, 51, 2) / 100;
					this.runningData.GridL1.Power = this.getIntFromByteArray(rcvbuf, 55, 2);
					this.runningData.GridL2.Voltage = this.getUintFromByteArray(rcvbuf, 57, 2) / 10;
					this.runningData.GridL2.Current = this.getUintFromByteArray(rcvbuf, 59, 2) / 10;
					this.runningData.GridL2.Frequency = this.getUintFromByteArray(rcvbuf, 61, 2) / 100;
					this.runningData.GridL2.Power = this.getIntFromByteArray(rcvbuf, 65, 2);
					this.runningData.GridL3.Voltage = this.getUintFromByteArray(rcvbuf, 67, 2) / 10;
					this.runningData.GridL3.Current = this.getUintFromByteArray(rcvbuf, 69, 2) / 10;
					this.runningData.GridL3.Frequency = this.getUintFromByteArray(rcvbuf, 71, 2) / 100;
					this.runningData.GridL3.Power = this.getIntFromByteArray(rcvbuf, 75, 2);
					this.runningData.GridMode = this.getUintFromByteArray(rcvbuf, 77, 2);
					this.runningData.InverterTotalPower = this.getIntFromByteArray(rcvbuf, 81, 2);
					this.runningData.AcActivePower = this.getIntFromByteArray(rcvbuf, 85, 2);
					this.runningData.AcReactivePower = this.getIntFromByteArray(rcvbuf, 89, 2);
					this.runningData.AcApparentPower = this.getIntFromByteArray(rcvbuf, 93, 2);
					this.runningData.BackUpL1.Voltage = this.getUintFromByteArray(rcvbuf, 95, 2) / 10;
					this.runningData.BackUpL1.Current = this.getUintFromByteArray(rcvbuf, 97, 2) / 10;
					this.runningData.BackUpL1.Frequency = this.getUintFromByteArray(rcvbuf, 99, 2) / 100;
					this.runningData.BackUpL1.Mode = this.getUintFromByteArray(rcvbuf, 101, 2);
					this.runningData.BackUpL1.Power = this.getIntFromByteArray(rcvbuf, 105, 2);
					this.runningData.BackUpL2.Voltage = this.getUintFromByteArray(rcvbuf, 107, 2) / 10;
					this.runningData.BackUpL2.Current = this.getUintFromByteArray(rcvbuf, 109, 2) / 10;
					this.runningData.BackUpL2.Frequency = this.getUintFromByteArray(rcvbuf, 111, 2) / 100;
					this.runningData.BackUpL2.Mode = this.getUintFromByteArray(rcvbuf, 113, 2);
					this.runningData.BackUpL2.Power = this.getIntFromByteArray(rcvbuf, 117, 2);
					this.runningData.BackUpL3.Voltage = this.getUintFromByteArray(rcvbuf, 119, 2) / 10;
					this.runningData.BackUpL3.Current = this.getUintFromByteArray(rcvbuf, 121, 2) / 10;
					this.runningData.BackUpL3.Frequency = this.getUintFromByteArray(rcvbuf, 123, 2) / 100;
					this.runningData.BackUpL3.Mode = this.getUintFromByteArray(rcvbuf, 125, 2);
					this.runningData.BackUpL3.Power = this.getIntFromByteArray(rcvbuf, 129, 2);
					this.runningData.PowerL1 = this.getIntFromByteArray(rcvbuf, 133, 2);
					this.runningData.PowerL2 = this.getIntFromByteArray(rcvbuf, 137, 2);
					this.runningData.PowerL3 = this.getIntFromByteArray(rcvbuf, 141, 2);
					this.runningData.TotalPowerBackUp = this.getIntFromByteArray(rcvbuf, 145, 2);
					this.runningData.TotalPower = this.getIntFromByteArray(rcvbuf, 149, 2);
					this.runningData.UpsLoadPercent = this.getUintFromByteArray(rcvbuf, 151, 2);
					this.runningData.AirTemperature = this.getIntFromByteArray(rcvbuf, 153, 2) / 10;
					this.runningData.ModulTemperature = this.getIntFromByteArray(rcvbuf, 155, 2) / 10;
					this.runningData.RadiatorTemperature = this.getIntFromByteArray(rcvbuf, 157, 2) / 10;
					this.runningData.FunctionBitValue = this.getUintFromByteArray(rcvbuf, 159, 2);
					this.runningData.BusVoltage = this.getUintFromByteArray(rcvbuf, 161, 2) / 10;
					this.runningData.NbusVoltage = this.getUintFromByteArray(rcvbuf, 163, 2) / 10;
					this.runningData.Battery1.Voltage = this.getUintFromByteArray(rcvbuf, 165, 2) / 10;
					this.runningData.Battery1.Current = this.getIntFromByteArray(rcvbuf, 167, 2) / 10;
					this.runningData.Battery1.Power = this.getIntFromByteArray(rcvbuf, 171, 2);
					this.runningData.Battery1.Mode = this.getUintFromByteArray(rcvbuf, 173, 2);
					this.runningData.WarningCode = this.getUintFromByteArray(rcvbuf, 175, 2);
					this.runningData.SaftyCountry = this.getUintFromByteArray(rcvbuf, 177, 2);
					this.runningData.WorkMode = this.getUintFromByteArray(rcvbuf, 179, 2);
					this.runningData.OperationMode = this.getUintFromByteArray(rcvbuf, 181, 2);
					this.runningData.ErrorMessage = this.getUintFromByteArray(rcvbuf, 183, 4);
					this.runningData.PvEnergyTotal = this.getUintFromByteArray(rcvbuf, 187, 4) / 10;
					this.runningData.PvEnergyDay = this.getUintFromByteArray(rcvbuf, 191, 4) / 10;
					this.runningData.EnergyTotal = this.getUintFromByteArray(rcvbuf, 195, 4) / 10;
					this.runningData.HoursTotal = this.getUintFromByteArray(rcvbuf, 199, 4);
					this.runningData.EnergyDaySell = this.getUintFromByteArray(rcvbuf, 203, 2) / 10;
					this.runningData.EnergyTotalBuy = this.getUintFromByteArray(rcvbuf, 205, 4) / 10;
					this.runningData.EnergyDayBuy = this.getUintFromByteArray(rcvbuf, 209, 2) / 10;
					this.runningData.EnergyTotalLoad = this.getUintFromByteArray(rcvbuf, 211, 4) / 10;
					this.runningData.EnergyDayLoad = this.getUintFromByteArray(rcvbuf, 215, 2) / 10;
					this.runningData.EnergyBatteryCharge = this.getUintFromByteArray(rcvbuf, 217, 4) / 10;
					this.runningData.EnergyDayCharge = this.getUintFromByteArray(rcvbuf, 221, 2) / 10;
					this.runningData.EnergyBatteryDischarge = this.getUintFromByteArray(rcvbuf, 223, 4) / 10;
					this.runningData.EnergyDayDischarge = this.getUintFromByteArray(rcvbuf, 227, 4) / 10;
					this.runningData.BatteryStrings = this.getUintFromByteArray(rcvbuf, 229, 2);
					this.runningData.CpldWarningCode = this.getUintFromByteArray(rcvbuf, 231, 2);
					this.runningData.WChargeCtrFlag = this.getUintFromByteArray(rcvbuf, 233, 2);
					this.runningData.DerateFlag = this.getUintFromByteArray(rcvbuf, 235, 2);
					this.runningData.DerateFrozenPower = this.getUintFromByteArray(rcvbuf, 237, 4);
					this.runningData.DiagStatusH = this.getUintFromByteArray(rcvbuf, 241, 4);
					this.runningData.DiagStatusL = this.getUintFromByteArray(rcvbuf, 245, 4);
					this.runningData.TotalPowerPv =
						this.runningData.Pv1.Power +
						this.runningData.Pv2.Power +
						this.runningData.Pv3.Power +
						this.runningData.Pv4.Power;
					this.status = GoodWeUdp.ConStatus.Online;
				} else {
					this.status = GoodWeUdp.ConStatus.Offline;
				}
			});

			this.client.send(sendbuf, 0, sendbuf.length, this.port, this.ipAddr, err => {
				if (err) throw err;
			});
		} catch (error) {
			this.adapter.log.error(`ReadRunningData: ${error}`);
		}
	}

	/** Queries external communication data (smart meter readings) from the inverter. */
	ReadExtComData(): void {
		const sendbuf = new Uint8Array(8);

		sendbuf[0] = GoodWeRegister.Addr.Inverter;
		sendbuf[1] = GoodWeRegister.FcDode.Read;
		sendbuf[2] = 0x8c;
		sendbuf[3] = 0xa0;
		sendbuf[4] = 0x00;
		sendbuf[5] = 0x1b;

		const crc = this.calculateCrc16(sendbuf, 0, 6);
		sendbuf[6] = crc >> 8;
		sendbuf[7] = crc & 0x00ff;

		try {
			this.client.on("message", rcvbuf => {
				if (this.checkRecRegisterData(rcvbuf, sendbuf[1], sendbuf[5])) {
					this.extComData.Commode = this.getUintFromByteArray(rcvbuf, 5, 2);
					this.extComData.Rssi = this.getUintFromByteArray(rcvbuf, 7, 2);
					this.extComData.ManufacturerCode = this.getUintFromByteArray(rcvbuf, 9, 2);
					this.extComData.MeterConnectStatus = this.getUintFromByteArray(rcvbuf, 11, 2);
					this.extComData.MeterCommunicateStatus = this.getUintFromByteArray(rcvbuf, 13, 2);
					this.extComData.L1.ActivePower = this.getIntFromByteArray(rcvbuf, 15, 2);
					this.extComData.L2.ActivePower = this.getIntFromByteArray(rcvbuf, 17, 2);
					this.extComData.L3.ActivePower = this.getIntFromByteArray(rcvbuf, 19, 2);
					this.extComData.TotalActivePower = this.getIntFromByteArray(rcvbuf, 21, 2);
					this.extComData.TotalReactivePower = this.getUintFromByteArray(rcvbuf, 23, 2);
					this.extComData.L1.PowerFactor = this.getUintFromByteArray(rcvbuf, 25, 2) / 100;
					this.extComData.L2.PowerFactor = this.getUintFromByteArray(rcvbuf, 27, 2) / 100;
					this.extComData.L3.PowerFactor = this.getUintFromByteArray(rcvbuf, 29, 2) / 100;
					this.extComData.PowerFactor = this.getUintFromByteArray(rcvbuf, 31, 2) / 100;
					this.extComData.Frequency = this.getUintFromByteArray(rcvbuf, 33, 2) / 100;
					this.extComData.EnergyTotalSell = this.getFloatFromByteArray(rcvbuf, 35, 4) / 10;
					this.extComData.EnergyTotalBuy = this.getFloatFromByteArray(rcvbuf, 39, 4) / 10;
					this.status = GoodWeUdp.ConStatus.Online;
				} else {
					this.status = GoodWeUdp.ConStatus.Offline;
				}
			});

			this.client.send(sendbuf, 0, sendbuf.length, this.port, this.ipAddr, err => {
				if (err) throw err;
			});
		} catch (error) {
			this.adapter.log.error(`ReadExtComData: ${error}`);
		}
	}

	/** Queries Battery Management System data from the inverter. */
	ReadBmsInfo(): void {
		const sendbuf = new Uint8Array(8);

		sendbuf[0] = GoodWeRegister.Addr.Inverter;
		sendbuf[1] = GoodWeRegister.FcDode.Read;
		sendbuf[2] = 0x90;
		sendbuf[3] = 0x8a;
		sendbuf[4] = 0x00;
		sendbuf[5] = 0x08;

		const crc = this.calculateCrc16(sendbuf, 0, 6);
		sendbuf[6] = crc >> 8;
		sendbuf[7] = crc & 0x00ff;

		try {
			this.client.on("message", rcvbuf => {
				if (this.checkRecRegisterData(rcvbuf, sendbuf[1], sendbuf[5])) {
					this.bmsInfo.Status = this.getUintFromByteArray(rcvbuf, 5, 2);
					this.bmsInfo.PackTemperature = this.getUintFromByteArray(rcvbuf, 7, 2) / 10;
					this.bmsInfo.CurrentMaxCharge = this.getUintFromByteArray(rcvbuf, 9, 2);
					this.bmsInfo.CurrentMaxDischarge = this.getUintFromByteArray(rcvbuf, 11, 2);
					this.bmsInfo.ErrorCode = this.getUintFromByteArray(rcvbuf, 13, 2);
					this.bmsInfo.SOC = this.getUintFromByteArray(rcvbuf, 15, 2);
					this.bmsInfo.SOH = this.getUintFromByteArray(rcvbuf, 17, 2);
					this.bmsInfo.BatteryStrings = this.getUintFromByteArray(rcvbuf, 19, 2);
					this.status = GoodWeUdp.ConStatus.Online;
				} else {
					this.status = GoodWeUdp.ConStatus.Offline;
				}
			});

			this.client.send(sendbuf, 0, sendbuf.length, this.port, this.ipAddr, err => {
				if (err) throw err;
			});
		} catch (error) {
			this.adapter.log.error(`ReadBmsInfo: ${error}`);
		}
	}

	/**
	 * Validates a received UDP packet against expected control and function codes.
	 *
	 * @param data Received UDP packet buffer
	 * @param ctrCode Expected control code
	 * @param fctCode Expected function code
	 * @returns True if packet header, address, codes, and checksum are all valid
	 */
	private checkRecPacket(data: Buffer, ctrCode: number, fctCode: number): boolean {
		const packetFormat = data.subarray(0, GoodWePacket.Format.Packet);
		const packetCrc = data.subarray(data.length - GoodWePacket.Format.Checksum, data.length);
		let crc = 0;

		for (let i = 0; i < data.length - GoodWePacket.Format.Checksum; i++) {
			crc = crc + data[i];
		}

		if (packetCrc[0] === crc >> 8 && packetCrc[1] === (crc & 0x00ff)) {
			if (packetFormat[0] === GoodWePacket.Header.High && packetFormat[1] === GoodWePacket.Header.Low) {
				if (packetFormat[2] === GoodWePacket.Addr.Inverter && packetFormat[3] === GoodWePacket.Addr.AP) {
					if (packetFormat[4] === ctrCode && packetFormat[5] === (fctCode | 0x80)) {
						return true;
					}
				}
			}
		}
		return false;
	}

	/**
	 * Validates a received Modbus register frame against expected function code and data length.
	 *
	 * @param data Received Modbus frame buffer
	 * @param fctCode Expected function code
	 * @param length Expected data length in registers (byte count = length * 2)
	 * @returns True if frame header, address, function code, length, and CRC16 are all valid
	 */
	private checkRecRegisterData(data: Buffer, fctCode: number, length: number): boolean {
		const registerFrame = data.subarray(0, GoodWeRegister.Format.Frame);
		const registerCrc = data.subarray(data.length - GoodWeRegister.Format.CRC16, data.length);
		const crc = this.calculateCrc16(data, 2, data.length - GoodWeRegister.Format.CRC16 - 2);

		if (registerCrc[0] === crc >> 8 && registerCrc[1] === (crc & 0x00ff)) {
			if (registerFrame[0] === GoodWeRegister.RecvHeader.High && registerFrame[1] === GoodWeRegister.RecvHeader.Low) {
				if (registerFrame[2] === GoodWeRegister.Addr.Inverter && registerFrame[3] === fctCode) {
					if (registerFrame[4] === length * 2) {
						return true;
					}
				}
			}
		}
		return false;
	}

	/**
	 * Reads a fixed-length ASCII string from a buffer slice.
	 *
	 * @param data Source buffer
	 * @param start Start byte offset
	 * @param length Number of bytes to read
	 * @returns Decoded ASCII string
	 */
	private getStringFromByteArray(data: Buffer, start: number, length: number): string {
		return data.subarray(start, start + length).toString("ascii");
	}

	/**
	 * Reads an unsigned integer from a big-endian buffer slice.
	 *
	 * @param data Source buffer
	 * @param start Start byte offset
	 * @param length Number of bytes to read (1–4)
	 * @returns Unsigned integer value
	 */
	private getUintFromByteArray(data: Buffer, start: number, length: number): number {
		let value = 0;
		for (let i = 0; i < length; i++) {
			value = (value << 8) + data[start + i];
		}
		return value;
	}

	/**
	 * Reads a signed integer from a big-endian buffer slice using two's complement.
	 *
	 * @param data Source buffer
	 * @param start Start byte offset
	 * @param length Number of bytes to read (1–4)
	 * @returns Signed integer value
	 */
	private getIntFromByteArray(data: Buffer, start: number, length: number): number {
		let value = 0;
		for (let i = 0; i < length; i++) {
			value = (value << 8) + data[start + i];
		}
		if ((value & 0x8000) === 0x8000) {
			value = ((value ^ 0xffff) + 1) * -1;
		}
		return value;
	}

	/**
	 * Reads an IEEE 754 single-precision float from a big-endian buffer slice.
	 *
	 * @param data Source buffer
	 * @param start Start byte offset
	 * @param length Number of bytes to read (must be 4)
	 * @returns Float value
	 */
	private getFloatFromByteArray(data: Buffer, start: number, length: number): number {
		const buf = data.subarray(start, start + length);
		const bits = (buf[0] << 24) | (buf[1] << 16) | (buf[2] << 8) | buf[3];
		const sign = bits >>> 31 === 0 ? 1.0 : -1.0;
		const e = (bits >>> 23) & 0xff;
		const m = e === 0 ? (bits & 0x7fffff) << 1 : (bits & 0x7fffff) | 0x800000;
		return sign * m * Math.pow(2, e - 150);
	}

	/**
	 * Computes the CRC16/Modbus checksum over a byte range, returned with bytes swapped.
	 *
	 * @param data Source buffer
	 * @param start Start byte offset
	 * @param length Number of bytes to process
	 * @returns CRC16 checksum with high and low bytes swapped
	 */
	private calculateCrc16(data: Buffer | Uint8Array, start: number, length: number): number {
		let crc = 0xffff;

		for (let pos = start; pos < start + length; pos++) {
			crc ^= data[pos];
			for (let i = 8; i !== 0; i--) {
				if ((crc & 0x0001) !== 0) {
					crc = (crc >> 1) ^ 0xa001;
				} else {
					crc >>= 1;
				}
			}
		}

		return ((crc & 0x00ff) << 8) + ((crc & 0xff00) >> 8);
	}

	/** Current connection status (online/offline). */
	get Status(): boolean {
		return this.status;
	}

	/** Inverter identification information. */
	get IdInfo(): GoodWeIdInfo {
		return this.idInfo;
	}

	/** Inverter device information. */
	get DeviceInfo(): GoodWeDeviceInfo {
		return this.deviceInfo;
	}

	/** Latest running data snapshot. */
	get RunningData(): GoodWeRunningData {
		return this.runningData;
	}

	/** Latest external communication data. */
	get ExtComData(): GoodWeExternalComData {
		return this.extComData;
	}

	/** Latest Battery Management System info. */
	get BmsInfo(): GoodweBmsInfo {
		return this.bmsInfo;
	}
}
