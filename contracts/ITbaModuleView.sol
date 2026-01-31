// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.20;

interface ITbaModuleView {
    function getInstalledExecutionModules() external view returns (address[] memory);
    function getExecutionSelectors(address module) external view returns (bytes4[] memory);
    function isSelectorAllowed(bytes4 selector) external view returns (bool);
}
