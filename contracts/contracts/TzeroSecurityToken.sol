// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TzeroSecurityToken
 * @notice ERC-3643 inspired security token for regulated equity assets on Tzero platform.
 * @dev Enforces accredited investor whitelist and configurable lock-up period.
 */
contract TzeroSecurityToken is ERC20, AccessControl, Ownable {
    bytes32 public constant WHITELISTED_ROLE = keccak256("WHITELISTED");

    string  public assetName;
    uint256 public preMoneyValuation;   // in USD cents
    uint256 public lockUpEnd;
    bool    public requiresAccreditedInvestors;

    event InvestorWhitelisted(address indexed account);
    event InvestorRemoved(address indexed account);
    event TokensMinted(address indexed to, uint256 amount);

    constructor(
        string memory _name,
        string memory _symbol,
        uint256 _preMoneyValuation,
        uint256 _lockUpMonths,
        bool    _requiresAccredited,
        address _owner
    ) ERC20(_name, _symbol) Ownable(_owner) {
        assetName = _name;
        preMoneyValuation = _preMoneyValuation;
        lockUpEnd = block.timestamp + (_lockUpMonths * 30 days);
        requiresAccreditedInvestors = _requiresAccredited;

        _grantRole(DEFAULT_ADMIN_ROLE, _owner);
        _grantRole(WHITELISTED_ROLE, _owner);
    }

    /**
     * @dev Override ERC20 transfer hook to enforce compliance rules.
     */
    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0)) {
            require(
                block.timestamp >= lockUpEnd,
                "TZT: Tokens are locked during the lock-up period"
            );
            if (requiresAccreditedInvestors && to != address(0)) {
                require(
                    hasRole(WHITELISTED_ROLE, to),
                    "TZT: Recipient must be a whitelisted accredited investor"
                );
            }
        }
        super._update(from, to, value);
    }

    /**
     * @notice Add an address to the accredited investor whitelist.
     */
    function whitelist(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _grantRole(WHITELISTED_ROLE, account);
        emit InvestorWhitelisted(account);
    }

    /**
     * @notice Remove an address from the whitelist.
     */
    function removeFromWhitelist(address account) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _revokeRole(WHITELISTED_ROLE, account);
        emit InvestorRemoved(account);
    }

    /**
     * @notice Mint new tokens. Only callable by owner.
     */
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
        emit TokensMinted(to, amount);
    }

    /**
     * @notice Returns the remaining lock-up time in seconds.
     */
    function lockUpRemaining() external view returns (uint256) {
        if (block.timestamp >= lockUpEnd) return 0;
        return lockUpEnd - block.timestamp;
    }

    /**
     * @notice Check if an address is whitelisted.
     */
    function isWhitelisted(address account) external view returns (bool) {
        return hasRole(WHITELISTED_ROLE, account);
    }
}
