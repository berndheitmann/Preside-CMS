component output=false extends="preside.system.base.Service" {

// CONSTRUCTOR
	public any function init( required struct permissionsConfig, required struct rolesConfig ) output=false {
		super.init( argumentCollection = arguments );

		_denormalizeConfiguredRolesAndPermissions( arguments.permissionsConfig, arguments.rolesConfig );

		return this;
	}

// PUBLIC API METHODS
	public array function listRoles() output=false {
		return _getRoles().keyArray();
	}

	public array function listPermissionKeys( string role="" ) output=false {
		if ( Len( Trim( arguments.role ) ) ) {
			return _getRolePermissions( arguments.role );
		}

		return _getPermissions();
	}


// PRIVATE HELPERS
	private void function _denormalizeConfiguredRolesAndPermissions( required struct permissionsConfig, required struct rolesConfig ) output=false {
		_setPermissions( _expandPermissions( arguments.permissionsConfig ) );
		_setRoles( _expandRoles( arguments.rolesConfig ) );
	}

	private array function _expandPermissions( required struct permissions, string prefix="" ) output=false {
		var expanded = [];

		for( var perm in permissions ){
			var newPrefix = ListAppend( arguments.prefix, perm, "." );

			if ( IsStruct( permissions[ perm ] ) ) {
				var childPerms = _expandPermissions( permissions[ perm ], newPrefix );
				for( var childPerm in childPerms ){
					expanded.append( childPerm );
				}
			} elseif ( IsArray( permissions[ perm ] ) ) {
				for( var key in permissions[ perm ] ) {
					if ( IsSimpleValue( key ) ) {
						expanded.append( ListAppend( newPrefix, key, "." ) );
					}
				}
			}
		}

		return expanded;
	}

	private struct function _expandRoles( required struct roles ) output=false {
		var expandedRoles = {};

		for( var roleName in arguments.roles ){
			var role = arguments.roles[ roleName ];
			var exclusions = [];

			expandedRoles[ roleName ] = [];

			if ( IsArray( role ) ) {
				for( var permissionKey in role ){
					if ( IsSimpleValue( permissionKey ) ) {
						if ( Left( permissionKey, 1 ) == "!" ) {
							exclusions.append( ReReplace( permissionKey, "^!(.*)$", "\1" ) );
						} elseif ( Find( "*", permissionKey ) ) {
							( _expandWildCardPermissionKey( permissionKey ) ).each( function( expandedKey ){
								if ( !expandedRoles[ roleName ].findNoCase( expandedKey ) ) {
									expandedRoles[ roleName ].append( expandedKey );
								}
							} );
						} else {
							expandedRoles[ roleName ].append( permissionKey );
						}
					}
				}
			}

			for( var exclusion in exclusions ){
				if ( Find( "*", exclusion ) ) {
					( _expandWildCardPermissionKey( exclusion ) ).each( function( expandedKey ){
						expandedRoles[ roleName ].delete( expandedKey );
					} );
				} else {
					expandedRoles[ roleName ].delete( exclusion );
				}
			}
		}

		return expandedRoles;
	}

	private array function _getRolePermissions( required string role ) output=false {
		var roles = _getRoles();

		return roles[ arguments.role ] ?: [];
	}

	private array function _expandWildCardPermissionKey( required string permissionKey ) output=false {
		var regex       = Replace( _reEscape( arguments.permissionKey ), "\*", "(.*?)", "all" );
		var permissions = _getPermissions();

		return permissions.filter( function( permKey ){
			return ReFindNoCase( regex, permKey );
		} );
	}

	private string function _reEscape( required string stringToEscape ) output=false {
		var charsToEscape = [ "\", "$","{","}","(",")","<",">","[","]","^",".","*","+","?","##",":","&" ];
		var escaped       = arguments.stringToEscape;

		for( var char in charsToEscape ){
			escaped = Replace( escaped, char, "\" & char, "all" );
		}

		return escaped;
	}

// GETTERS AND SETTERS
	private struct function _getRoles() output=false {
		return _roles;
	}
	private void function _setRoles( required struct roles ) output=false {
		_roles = arguments.roles;
	}

	private array function _getPermissions() output=false {
		return _permissions;
	}
	private void function _setPermissions( required array permissions ) output=false {
		_permissions = arguments.permissions;
	}
}