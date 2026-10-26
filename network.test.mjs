import test from 'node:test';import assert from 'node:assert/strict';import {publicIP} from './network.mjs';
test('public IPv4 and IPv6 are allowed',()=>{for(const ip of ['185.199.108.133','8.8.8.8','2606:50c0:8000::154','2a06:98c1:3120::3'])assert.equal(publicIP(ip),true,ip)});
test('local, private and mapped addresses are rejected',()=>{for(const ip of ['127.0.0.1','10.0.0.1','172.16.0.1','169.254.169.254','192.168.0.1','::1','::ffff:127.0.0.1','fe80::1','fc00::1','2001:db8::1','not-an-ip'])assert.equal(publicIP(ip),false,ip)});
